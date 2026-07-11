/* Work Counter — suivi du temps hors ligne, 100% navigateur */
(() => {
  "use strict";

  const STORAGE_KEY = "work-counter:data:v1";
  const THEME_KEY = "work-counter:theme";

  /** @type {{clients: Array<{id:string,name:string,projects:Array<{id:string,name:string,sessions:Array<{start:number,end:number|null}>}>}>}} */
  let state = { clients: [] };

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.clients)) state = parsed;
      }
    } catch (e) {
      console.error("Lecture des données impossible", e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Sauvegarde impossible", e);
      toast("Sauvegarde impossible (stockage plein ?)");
    }
  }

  // ---------- Helpers ----------
  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const now = () => Date.now();

  function projectElapsed(project) {
    return project.sessions.reduce((total, s) => {
      const end = s.end == null ? now() : s.end;
      return total + Math.max(0, end - s.start);
    }, 0);
  }

  function clientElapsed(client) {
    return client.projects.reduce((t, p) => t + projectElapsed(p), 0);
  }

  function isProjectRunning(project) {
    return project.sessions.some((s) => s.end == null);
  }

  function anyRunning() {
    return state.clients.some((c) => c.projects.some(isProjectRunning));
  }

  function completedSessions(project) {
    return project.sessions.filter((s) => s.end != null).length;
  }

  // Format ms -> "1h 05m" (compact) or with seconds
  function fmt(ms, withSeconds) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (withSeconds) return `${h}h ${pad(m)}m ${pad(s)}s`;
    return `${h}h ${pad(m)}m`;
  }

  // ---------- Mutations ----------
  function findClient(id) {
    return state.clients.find((c) => c.id === id);
  }

  function addProject(clientName, projectName) {
    clientName = clientName.trim();
    projectName = projectName.trim();
    if (!clientName || !projectName) return;

    let client = state.clients.find(
      (c) => c.name.toLowerCase() === clientName.toLowerCase()
    );
    if (!client) {
      client = { id: uid(), name: clientName, projects: [] };
      state.clients.push(client);
    }

    const exists = client.projects.some(
      (p) => p.name.toLowerCase() === projectName.toLowerCase()
    );
    if (exists) {
      toast(`« ${projectName} » existe déjà pour ce client`);
      return;
    }

    client.projects.push({ id: uid(), name: projectName, sessions: [] });
    save();
    render();
    toast(`Projet « ${projectName} » ajouté`);
  }

  function toggleTimer(clientId, projectId) {
    const client = findClient(clientId);
    if (!client) return;
    const project = client.projects.find((p) => p.id === projectId);
    if (!project) return;

    if (isProjectRunning(project)) {
      project.sessions.forEach((s) => {
        if (s.end == null) s.end = now();
      });
    } else {
      project.sessions.push({ start: now(), end: null });
    }
    save();
    render();
  }

  function deleteProject(clientId, projectId) {
    const client = findClient(clientId);
    if (!client) return;
    const project = client.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (!confirm(`Supprimer le projet « ${project.name} » et son historique ?`))
      return;
    client.projects = client.projects.filter((p) => p.id !== projectId);
    if (client.projects.length === 0) {
      state.clients = state.clients.filter((c) => c.id !== clientId);
    }
    save();
    render();
    toast("Projet supprimé");
  }

  function deleteClient(clientId) {
    const client = findClient(clientId);
    if (!client) return;
    if (
      !confirm(
        `Supprimer le client « ${client.name} » et tous ses projets ?`
      )
    )
      return;
    state.clients = state.clients.filter((c) => c.id !== clientId);
    save();
    render();
    toast("Client supprimé");
  }

  // ---------- Export / Import ----------
  function exportData() {
    if (state.clients.length === 0) {
      toast("Rien à exporter");
      return;
    }
    const payload = {
      app: "work-counter",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `work-counter-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Données exportées");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed && parsed.data ? parsed.data : parsed;
        if (!incoming || !Array.isArray(incoming.clients)) {
          throw new Error("Format invalide");
        }
        const mode = state.clients.length
          ? confirm(
              "Fusionner avec vos données actuelles ?\n\nOK = fusionner · Annuler = remplacer"
            )
          : true;
        if (mode) {
          mergeState(incoming);
        } else {
          state = incoming;
        }
        save();
        render();
        toast("Données importées");
      } catch (e) {
        console.error(e);
        toast("Fichier invalide");
      }
    };
    reader.readAsText(file);
  }

  function mergeState(incoming) {
    incoming.clients.forEach((inClient) => {
      let client = state.clients.find(
        (c) => c.name.toLowerCase() === inClient.name.toLowerCase()
      );
      if (!client) {
        client = { id: uid(), name: inClient.name, projects: [] };
        state.clients.push(client);
      }
      inClient.projects.forEach((inProj) => {
        let proj = client.projects.find(
          (p) => p.name.toLowerCase() === inProj.name.toLowerCase()
        );
        if (!proj) {
          proj = { id: uid(), name: inProj.name, sessions: [] };
          client.projects.push(proj);
        }
        // append sessions not already present (by start+end signature)
        const sig = new Set(proj.sessions.map((s) => `${s.start}:${s.end}`));
        (inProj.sessions || []).forEach((s) => {
          if (!sig.has(`${s.start}:${s.end}`)) proj.sessions.push(s);
        });
        proj.sessions.sort((a, b) => a.start - b.start);
      });
    });
  }

  // ---------- Rendering ----------
  const els = {
    clients: document.getElementById("clients"),
    empty: document.getElementById("emptyState"),
    summary: document.getElementById("summary"),
    statClients: document.getElementById("statClients"),
    statProjects: document.getElementById("statProjects"),
    statTime: document.getElementById("statTime"),
    liveCard: document.getElementById("liveCard"),
    statLive: document.getElementById("statLive"),
    clientsList: document.getElementById("clientsList"),
  };

  const collapsed = new Set(); // client ids that are collapsed

  function render() {
    const hasData = state.clients.length > 0;
    els.empty.hidden = hasData;
    els.summary.hidden = !hasData;

    // datalist of client names
    els.clientsList.innerHTML = "";
    state.clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      els.clientsList.appendChild(opt);
    });

    els.clients.innerHTML = "";
    const clientTpl = document.getElementById("clientTemplate");
    const projectTpl = document.getElementById("projectTemplate");

    let totalProjects = 0;

    state.clients.forEach((client) => {
      totalProjects += client.projects.length;
      const node = clientTpl.content.cloneNode(true);
      const card = node.querySelector(".client-card");
      card.dataset.id = client.id;
      if (collapsed.has(client.id)) card.classList.add("collapsed");

      node.querySelector(".client-name").textContent = client.name;
      const totalEl = node.querySelector(".client-total");
      totalEl.textContent = fmt(clientElapsed(client));

      node.querySelector(".client-toggle").addEventListener("click", () => {
        if (collapsed.has(client.id)) collapsed.delete(client.id);
        else collapsed.add(client.id);
        card.classList.toggle("collapsed");
      });

      node
        .querySelector(".client-delete")
        .addEventListener("click", () => deleteClient(client.id));

      const list = node.querySelector(".project-list");
      client.projects.forEach((project) => {
        const pNode = projectTpl.content.cloneNode(true);
        const row = pNode.querySelector(".project-row");
        row.dataset.clientId = client.id;
        row.dataset.projectId = project.id;
        const running = isProjectRunning(project);
        if (running) row.classList.add("running");

        pNode.querySelector(".project-name").textContent = project.name;
        const count = completedSessions(project) + (running ? 1 : 0);
        pNode.querySelector(".project-sessions").textContent =
          count === 0
            ? "Aucune session"
            : `${count} session${count > 1 ? "s" : ""}`;

        pNode.querySelector(".project-time").textContent = fmt(
          projectElapsed(project),
          running
        );

        pNode.querySelector(".timer-label").textContent = running
          ? "Arrêter"
          : "Démarrer";

        pNode
          .querySelector(".btn-timer")
          .addEventListener("click", () =>
            toggleTimer(client.id, project.id)
          );
        pNode
          .querySelector(".project-delete")
          .addEventListener("click", () =>
            deleteProject(client.id, project.id)
          );

        list.appendChild(pNode);
      });

      els.clients.appendChild(node);
    });

    els.statClients.textContent = String(state.clients.length);
    els.statProjects.textContent = String(totalProjects);
    els.statTime.textContent = fmt(
      state.clients.reduce((t, c) => t + clientElapsed(c), 0)
    );

    updateLive();
  }

  // Lightweight per-second update for running timers (no full re-render)
  function updateLive() {
    let liveTotal = 0;
    let hasLive = false;

    state.clients.forEach((client) => {
      let clientHasRunning = false;
      client.projects.forEach((project) => {
        const running = isProjectRunning(project);
        if (running) {
          hasLive = true;
          clientHasRunning = true;
          liveTotal += projectElapsed(project);
        }
      });
      // update client total live if it has a running project
      if (clientHasRunning) {
        const card = els.clients.querySelector(
          `.client-card[data-id="${client.id}"] .client-total`
        );
        if (card) card.textContent = fmt(clientElapsed(client));
      }
    });

    // update each running project row's time
    els.clients.querySelectorAll(".project-row.running").forEach((row) => {
      const client = findClient(row.dataset.clientId);
      if (!client) return;
      const project = client.projects.find(
        (p) => p.id === row.dataset.projectId
      );
      if (!project) return;
      const timeEl = row.querySelector(".project-time");
      if (timeEl) timeEl.textContent = fmt(projectElapsed(project), true);
    });

    // global total (recompute so it ticks with running work)
    els.statTime.textContent = fmt(
      state.clients.reduce((t, c) => t + clientElapsed(c), 0)
    );

    els.liveCard.hidden = !hasLive;
    if (hasLive) els.statLive.textContent = fmt(liveTotal, true);
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- Events ----------
  function bindEvents() {
    document.getElementById("addForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const clientInput = document.getElementById("clientInput");
      const projectInput = document.getElementById("projectInput");
      addProject(clientInput.value, projectInput.value);
      projectInput.value = "";
      projectInput.focus();
    });

    document
      .getElementById("themeBtn")
      .addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(current);
      });

    document
      .getElementById("exportBtn")
      .addEventListener("click", exportData);

    const importInput = document.getElementById("importInput");
    document
      .getElementById("importBtn")
      .addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importData(file);
      importInput.value = "";
    });

    // Warn before leaving if a timer is running
    window.addEventListener("beforeunload", (e) => {
      if (anyRunning()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // ---------- Init ----------
  initTheme();
  load();
  bindEvents();
  render();
  setInterval(updateLive, 1000);
})();
