(() => {
  const storageKey = "app-mgmt-prototype-data";
  const defaultApps = [
    {
      id: "app-01",
      name: "智能制造控制中心",
      code: "IMCC",
      workspace: "制造云",
      contact: "张伟 · zhangwei@basf.com",
      description: "覆盖生产监控、设备告警、产能分析的一体化平台。",
      summary: {
        repos: 4,
        dev: 8,
        sit: 6,
        uat: 2,
        prod: 1
      }
    },
    {
      id: "app-02",
      name: "供应链协同门户",
      code: "SCP",
      workspace: "协同云",
      contact: "李娜 · lina@basf.com",
      description: "供应链上下游协同、订单管理与交付监控。",
      summary: {
        repos: 2,
        dev: 5,
        sit: 4,
        uat: 3,
        prod: 2
      }
    },
    {
      id: "app-03",
      name: "能源绩效洞察",
      code: "EPI",
      workspace: "能源云",
      contact: "王强 · wangqiang@basf.com",
      description: "能源用量监控与绩效分析。",
      summary: {
        repos: 3,
        dev: 4,
        sit: 5,
        uat: 1,
        prod: 1
      }
    }
  ];

  const workspaceOptions = ["制造云", "协同云", "能源云", "实验云"];

  const loadApps = () => {
    const cached = localStorage.getItem(storageKey);
    if (!cached) {
      localStorage.setItem(storageKey, JSON.stringify(defaultApps));
      return [...defaultApps];
    }
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [...defaultApps];
    } catch (error) {
      return [...defaultApps];
    }
  };

  const saveApps = (apps) => {
    localStorage.setItem(storageKey, JSON.stringify(apps));
  };

  const byId = (id) => document.getElementById(id);

  const isDetailPage = () => window.location.pathname.endsWith("app-detail.html");

  if (!isDetailPage()) {
    initListPage();
  } else {
    initDetailPage();
  }

  function initListPage() {
    const appTableBody = byId("appTableBody");
    const workspaceFilter = byId("workspaceFilter");
    const createBtn = byId("createAppBtn");
    const appModal = new bootstrap.Modal(byId("appModal"));
    const deleteModal = new bootstrap.Modal(byId("confirmDeleteModal"));
    const appForm = byId("appForm");
    const appModalTitle = byId("appModalTitle");
    const saveAppBtn = byId("saveAppBtn");
    const confirmDeleteBtn = byId("confirmDeleteBtn");

    let apps = loadApps();
    let editingId = null;
    let deletingId = null;

    const refreshWorkspaceFilter = () => {
      const options = new Set(["all", ...workspaceOptions, ...apps.map((app) => app.workspace)]);
      workspaceFilter.innerHTML = "";
      options.forEach((workspace) => {
        const option = document.createElement("option");
        option.value = workspace;
        option.textContent = workspace === "all" ? "全部" : workspace;
        workspaceFilter.appendChild(option);
      });
    };

    const renderApps = () => {
      const filterValue = workspaceFilter.value || "all";
      appTableBody.innerHTML = "";
      const filtered = apps.filter((app) => filterValue === "all" || app.workspace === filterValue);
      filtered.forEach((app) => {
        const summary = {
          repos: 0,
          dev: 0,
          sit: 0,
          uat: 0,
          prod: 0,
          ...(app.summary || {})
        };
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>
            <a class="fw-semibold" href="app-detail.html?id=${app.id}">${app.name}</a>
          </td>
          <td>${app.code}</td>
          <td>${app.workspace}</td>
          <td>${app.contact || "-"}</td>
          <td>
            <div class="summary-grid">
              <span>代码仓库 ${summary.repos}</span>
              <span>DEV ${summary.dev}</span>
              <span>SIT ${summary.sit}</span>
              <span>UAT ${summary.uat}</span>
              <span>PROD ${summary.prod}</span>
            </div>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${app.id}">编辑</button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${app.id}">删除</button>
          </td>
        `;
        appTableBody.appendChild(row);
      });
    };

    const openModalForCreate = () => {
      editingId = null;
      appModalTitle.textContent = "创建应用";
      appForm.reset();
      appForm.elements.workspace.innerHTML = buildWorkspaceOptions();
      appModal.show();
    };

    const openModalForEdit = (app) => {
      editingId = app.id;
      appModalTitle.textContent = "编辑应用";
      appForm.reset();
      appForm.elements.workspace.innerHTML = buildWorkspaceOptions(app.workspace);
      appForm.elements.name.value = app.name;
      appForm.elements.code.value = app.code;
      appForm.elements.workspace.value = app.workspace;
      appForm.elements.contact.value = app.contact || "";
      appForm.elements.description.value = app.description;
      appModal.show();
    };

    const buildWorkspaceOptions = (selected) => {
      const options = ["<option value=\"\">请选择</option>"];
      workspaceOptions.forEach((workspace) => {
        const isSelected = workspace === selected ? "selected" : "";
        options.push(`<option value="${workspace}" ${isSelected}>${workspace}</option>`);
      });
      return options.join("");
    };

    const handleSave = () => {
      if (!appForm.reportValidity()) {
        return;
      }
      const formData = new FormData(appForm);
      const payload = {
        name: formData.get("name").trim(),
        code: formData.get("code").trim().toUpperCase(),
        workspace: formData.get("workspace"),
        contact: formData.get("contact").trim(),
        description: formData.get("description").trim()
      };

      if (editingId) {
        apps = apps.map((app) =>
          app.id === editingId
            ? {
                ...app,
                ...payload
              }
            : app
        );
      } else {
        apps.unshift({
          id: `app-${Date.now()}`,
          ...payload,
          summary: {
            repos: 0,
            dev: 0,
            sit: 0,
            uat: 0,
            prod: 0
          }
        });
      }

      saveApps(apps);
      refreshWorkspaceFilter();
      renderApps();
      appModal.hide();
    };

    const openDeleteModal = (id) => {
      deletingId = id;
      deleteModal.show();
    };

    const confirmDelete = () => {
      if (!deletingId) {
        return;
      }
      apps = apps.filter((app) => app.id !== deletingId);
      saveApps(apps);
      refreshWorkspaceFilter();
      renderApps();
      deleteModal.hide();
      deletingId = null;
    };

    workspaceFilter.addEventListener("change", renderApps);
    createBtn.addEventListener("click", openModalForCreate);
    saveAppBtn.addEventListener("click", handleSave);
    confirmDeleteBtn.addEventListener("click", confirmDelete);

    appTableBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (action === "edit") {
        const app = apps.find((item) => item.id === id);
        if (app) {
          openModalForEdit(app);
        }
      }
      if (action === "delete") {
        openDeleteModal(id);
      }
    });

    refreshWorkspaceFilter();
    renderApps();
  }

  function initDetailPage() {
    const query = new URLSearchParams(window.location.search);
    const appId = query.get("id");
    const apps = loadApps();
    const app = apps.find((item) => item.id === appId) || apps[0];

    const appDetailHeader = byId("appDetailHeader");
    appDetailHeader.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h2 class="h4 mb-1">${app.name}</h2>
          <div class="text-muted">代号：${app.code} · 工作区：${app.workspace}</div>
          <div class="text-muted-small">联系人：${app.contact || "-"}</div>
        </div>
        <div class="text-muted-small">${app.description}</div>
      </div>
    `;

    const resources = {
      dev: {
        env: "DEV",
        status: "created",
        count: 10,
        cost: "¥ 18,900/月"
      },
      sit: {
        env: "SIT",
        status: "created",
        count: 6,
        cost: "¥ 32,400/月"
      },
      uat: {
        env: "UAT",
        status: "pending-create",
        count: 0,
        cost: "-"
      },
      prod: {
        env: "PROD",
        status: "not-created",
        count: 0,
        cost: "-"
      }
    };

    const codeRepos = [
      { name: "app-core-service", url: "https://dev.azure.com/" },
      { name: "app-ui-portal", url: "https://dev.azure.com/" },
      { name: "app-data-pipeline", url: "https://dev.azure.com/" }
    ];

    const imageRepo = {
      enabled: true,
      registry: "acr-app-${app.code.toLowerCase()}",
      images: ["web:v1.2.0", "api:v1.1.8", "worker:v1.0.3"]
    };

    const wizardState = {
      step: 1,
      template: "custom",
      modules: [],
      params: {}
    };

    const wizardModal = new bootstrap.Modal(byId("wizardModal"));
    const editParamsModal = new bootstrap.Modal(byId("editParamsModal"));
    const editResourceModal = new bootstrap.Modal(byId("editResourceModal"));
    const approvalModal = new bootstrap.Modal(byId("approvalModal"));
    const confirmModal = new bootstrap.Modal(byId("confirmModal"));
    const logModal = new bootstrap.Modal(byId("logModal"));

    let activeEnv = "";
    let pendingAction = null;

    const renderCodeRepoTile = () => {
      const tile = byId("codeRepoTile");
      tile.innerHTML = `
        <div class="tile-header">
          <div class="tile-title">代码仓库</div>
          <button class="btn btn-sm btn-outline-primary" id="addRepoBtn">创建</button>
        </div>
        <div class="text-muted mb-2">数量：${codeRepos.length}</div>
        <ul class="repo-list" id="repoList">
          ${codeRepos
            .map(
              (repo, index) => `
                <li>
                  <a href="${repo.url}" target="_blank" rel="noreferrer">${repo.name}</a>
                  <button class="btn btn-sm btn-outline-danger" data-repo-index="${index}">删除</button>
                </li>
              `
            )
            .join("")}
        </ul>
      `;

      const repoList = byId("repoList");
      repoList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const index = target.dataset.repoIndex;
        if (index !== undefined) {
          openConfirm("删除仓库", "确认删除该代码仓库？", () => {
            codeRepos.splice(Number(index), 1);
            renderCodeRepoTile();
          });
        }
      });

      byId("addRepoBtn").addEventListener("click", () => {
        openConfirm(
          "新增仓库",
          `<div class=\"mb-2\">仓库名称</div>
           <input class=\"form-control\" id=\"repoNameInput\" placeholder=\"输入仓库名称\" />`,
          () => {
            const input = byId("repoNameInput");
            if (input && input.value.trim()) {
              codeRepos.push({ name: input.value.trim(), url: "https://dev.azure.com/" });
              renderCodeRepoTile();
            }
          }
        );
      });
    };

    const renderImageRepoTile = () => {
      const tile = byId("imageRepoTile");
      if (imageRepo.enabled) {
        tile.innerHTML = `
          <div class="tile-header">
            <div class="tile-title">镜像仓库</div>
            <span class="status-badge status-created">已启用</span>
          </div>
          <div class="mb-2">仓库名称：${imageRepo.registry}</div>
          <div class="text-muted">镜像列表：</div>
          <ul class="repo-list">
            ${imageRepo.images.map((image) => `<li>${image}</li>`).join("")}
          </ul>
        `;
      } else {
        tile.innerHTML = `
          <div class="tile-header">
            <div class="tile-title">镜像仓库</div>
            <span class="status-badge status-empty">未启用</span>
          </div>
          <p class="text-muted">尚未启用镜像仓库。</p>
          <button class="btn btn-outline-primary" id="enableImageRepoBtn">启用</button>
        `;
        byId("enableImageRepoBtn").addEventListener("click", () => {
          imageRepo.enabled = true;
          renderImageRepoTile();
        });
      }
    };

    const renderCloudTile = (envKey) => {
      const tile = byId(`${envKey}Tile`);
      const resource = resources[envKey];
      const statusMeta = getStatusMeta(resource.status);
      tile.innerHTML = `
        <div class="tile-header">
          <div class="tile-title">${resource.env} 云资源</div>
          <span class="status-badge ${statusMeta.badge}">${statusMeta.label}</span>
        </div>
        <div class="mb-2">数量：${resource.count}</div>
        <div class="mb-3">成本：${resource.cost}</div>
        <div class="d-flex flex-wrap gap-2" id="${envKey}Actions"></div>
      `;

      const actions = byId(`${envKey}Actions`);
      const addButton = (label, action, variant = "outline-primary") => {
        const button = document.createElement("button");
        button.className = `btn btn-sm btn-${variant}`;
        button.textContent = label;
        button.dataset.action = action;
        actions.appendChild(button);
      };

      switch (resource.status) {
        case "created":
          addButton("编辑参数", "edit-params", "outline-secondary");
          addButton("编辑资源", "edit-resource", "outline-secondary");
          addButton("删除", "delete", "outline-danger");
          break;
        case "not-created":
          addButton("创建", "create", "primary");
          break;
        case "pending-create":
          addButton("批准", "approve", "success");
          addButton("拒绝", "reject", "danger");
          break;
        case "pending-edit":
          addButton("批准", "approve", "success");
          addButton("拒绝", "reject", "danger");
          break;
        case "deploying":
          addButton("查看日志", "logs", "outline-primary");
          break;
        case "deleting":
          addButton("查看日志", "logs", "outline-primary");
          break;
        default:
          break;
      }

      actions.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const action = target.dataset.action;
        if (!action) {
          return;
        }
        activeEnv = envKey;
        handleCloudAction(action);
      });
    };

    const renderAllCloudTiles = () => {
      renderCloudTile("dev");
      renderCloudTile("sit");
      renderCloudTile("uat");
      renderCloudTile("prod");
    };

    const handleCloudAction = (action) => {
      if (action === "create") {
        wizardState.step = 1;
        wizardState.template = "custom";
        wizardState.modules = [];
        wizardState.params = {};
        renderWizard();
        wizardModal.show();
        return;
      }
      if (action === "edit-params") {
        renderEditParams();
        editParamsModal.show();
        return;
      }
      if (action === "edit-resource") {
        renderEditResource();
        editResourceModal.show();
        return;
      }
      if (action === "delete") {
        openConfirm("删除云资源", "确认删除该云资源？", () => {
          resources[activeEnv].status = "deleting";
          renderAllCloudTiles();
        });
        return;
      }
      if (action === "approve") {
        renderApprovalModal("批准");
        approvalModal.show();
        return;
      }
      if (action === "reject") {
        renderApprovalModal("拒绝");
        approvalModal.show();
        return;
      }
      if (action === "logs") {
        showLogs();
      }
    };

    const getStatusMeta = (status) => {
      const map = {
        created: { label: "已创建", badge: "status-created" },
        "not-created": { label: "未创建", badge: "status-empty" },
        "pending-create": { label: "待批准创建", badge: "status-pending" },
        "pending-edit": { label: "待批准编辑", badge: "status-pending" },
        deploying: { label: "正在部署", badge: "status-processing" },
        deleting: { label: "正在删除", badge: "status-processing" }
      };
      return map[status] || map["not-created"];
    };

    const renderWizard = () => {
      const steps = ["模板选择", "参数配置", "脚本预览", "确认信息"];
      const stepContainer = byId("wizardSteps");
      stepContainer.innerHTML = steps
        .map(
          (label, index) => `
            <div class="wizard-step ${wizardState.step === index + 1 ? "active" : ""}">
              Step ${index + 1} · ${label}
            </div>
          `
        )
        .join("");

      const wizardContent = byId("wizardContent");
      wizardContent.innerHTML = "";

      if (wizardState.step === 1) {
        wizardContent.appendChild(renderTemplateStep());
      }
      if (wizardState.step === 2) {
        wizardContent.appendChild(renderParamsStep());
      }
      if (wizardState.step === 3) {
        wizardContent.appendChild(renderScriptStep());
      }
      if (wizardState.step === 4) {
        wizardContent.appendChild(renderConfirmStep());
      }

      byId("wizardPrevBtn").disabled = wizardState.step === 1;
      byId("wizardNextBtn").textContent = wizardState.step === 4 ? "确认创建" : "下一步";
    };

    const renderTemplateStep = () => {
      const container = document.createElement("div");
      container.className = "row g-3";
      const templates = [
        { id: "custom", label: "自定义模板" },
        { id: "web", label: "Web 应用模板" },
        { id: "data", label: "数据分析模板" }
      ];

      const left = document.createElement("div");
      left.className = "col-md-4";
      left.innerHTML = `
        <div class="list-group">
          ${templates
            .map(
              (item) => `
                <button class="list-group-item list-group-item-action ${
                  wizardState.template === item.id ? "active" : ""
                }" data-template="${item.id}">
                  ${item.label}
                </button>
              `
            )
            .join("")}
        </div>
      `;

      const right = document.createElement("div");
      right.className = "col-md-8";
      right.id = "templateDetail";
      right.appendChild(renderTemplateDetail());

      container.appendChild(left);
      container.appendChild(right);

      left.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const template = target.dataset.template;
        if (template) {
          wizardState.template = template;
          renderWizard();
        }
      });

      return container;
    };

    const renderTemplateDetail = () => {
      const detail = document.createElement("div");
      if (wizardState.template === "custom") {
        detail.innerHTML = `
          <div class="mb-3">
            <label class="form-label">可选组件</label>
            <div class="d-flex gap-2">
              <select class="form-select" id="componentSelect">
                <option value="vnet">VNet</option>
                <option value="aks">AKS</option>
                <option value="postgres">PostgreSQL</option>
                <option value="redis">Redis</option>
              </select>
              <input class="form-control" placeholder="模块名称" id="moduleNameInput" />
              <button class="btn btn-primary" id="addModuleBtn">添加</button>
            </div>
          </div>
          <div>
            <div class="fw-semibold mb-2">已添加模块</div>
            <div id="moduleList"></div>
          </div>
        `;

        const moduleList = detail.querySelector("#moduleList");
        const renderModules = () => {
          if (!moduleList) {
            return;
          }
          moduleList.innerHTML = wizardState.modules
            .map(
              (module, index) => `
                <div class="d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2">
                  <div>${module.name} · <span class="text-muted">${module.component}</span></div>
                  <button class="btn btn-sm btn-outline-danger" data-index="${index}">删除</button>
                </div>
              `
            )
            .join("");
        };

        renderModules();

        detail.querySelector("#addModuleBtn").addEventListener("click", () => {
          const componentSelect = detail.querySelector("#componentSelect");
          const moduleNameInput = detail.querySelector("#moduleNameInput");
          if (!componentSelect || !moduleNameInput) {
            return;
          }
          if (!moduleNameInput.value.trim()) {
            return;
          }
          wizardState.modules.push({
            component: componentSelect.value,
            name: moduleNameInput.value.trim()
          });
          moduleNameInput.value = "";
          renderModules();
        });

        moduleList.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }
          const index = target.dataset.index;
          if (index !== undefined) {
            wizardState.modules.splice(Number(index), 1);
            renderModules();
          }
        });
      } else {
        const builtInModules =
          wizardState.template === "web"
            ? ["VNet", "App Service", "Redis", "Application Insights"]
            : ["VNet", "Databricks", "Data Lake", "Key Vault"];
        detail.innerHTML = `
          <div class="fw-semibold mb-2">模板包含模块</div>
          <ul class="list-group">
            ${builtInModules.map((module) => `<li class="list-group-item">${module}</li>`).join("")}
          </ul>
        `;
      }
      return detail;
    };

    const renderParamsStep = () => {
      const container = document.createElement("div");
      const groups = [
        {
          title: "网络配置",
          params: [
            { name: "vnet_cidr", type: "string", value: "10.10.0.0/16" },
            { name: "subnet_cidr", type: "string", value: "10.10.1.0/24" }
          ]
        },
        {
          title: "计算配置",
          params: [
            { name: "node_count", type: "number", value: 3 },
            { name: "sku", type: "string", value: "Standard_D4s_v5" }
          ]
        },
        {
          title: "安全配置",
          params: [
            { name: "enable_private_link", type: "boolean", value: true },
            { name: "key_vault_name", type: "string", value: "kv-${app.code.toLowerCase()}" }
          ]
        }
      ];

      container.innerHTML = groups
        .map(
          (group, index) => `
          <div class="form-section" data-group="${index}">
            <div class="section-header">
              <div class="fw-semibold">${group.title}</div>
              <button class="btn btn-sm btn-outline-secondary" data-toggle="collapse">折叠</button>
            </div>
            <div class="section-body">
              ${group.params
                .map(
                  (param) => `
                    <div class="row g-2 align-items-center mb-2">
                      <div class="col-md-4 text-muted">${param.name}</div>
                      <div class="col-md-3 text-muted-small">${param.type}</div>
                      <div class="col-md-5">
                        <input class="form-control" data-param="${param.name}" value="${param.value}" />
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        `
        )
        .join("");

      container.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.dataset.toggle === "collapse") {
          const section = target.closest(".form-section");
          const body = section?.querySelector(".section-body");
          if (body) {
            const isHidden = body.classList.toggle("d-none");
            target.textContent = isHidden ? "展开" : "折叠";
          }
        }
      });

      return container;
    };

    const renderScriptStep = () => {
      const container = document.createElement("div");
      const files = {
        "main.tf": `module "network" {\n  source = "./modules/network"\n}\n\nmodule "compute" {\n  source = "./modules/compute"\n}\n`,
        "variables.tf": `variable "vnet_cidr" {\n  type = string\n}\n\nvariable "node_count" {\n  type = number\n}\n`,
        "outputs.tf": `output "aks_name" {\n  value = module.compute.aks_name\n}\n`
      };

      const tabs = Object.keys(files)
        .map(
          (file, index) => `
            <li class="nav-item" role="presentation">
              <button class="nav-link ${index === 0 ? "active" : ""}" data-bs-toggle="tab" data-bs-target="#tab-${file}">${file}</button>
            </li>
          `
        )
        .join("");

      const panes = Object.entries(files)
        .map(
          ([file, content], index) => `
            <div class="tab-pane fade ${index === 0 ? "show active" : ""}" id="tab-${file}">
              <pre class="log-view">${content}</pre>
            </div>
          `
        )
        .join("");

      container.innerHTML = `
        <ul class="nav nav-pills tf-tabs mb-3">${tabs}</ul>
        <div class="tab-content">${panes}</div>
      `;

      return container;
    };

    const renderConfirmStep = () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="mb-3">
          <div class="fw-semibold">模板信息</div>
          <div class="text-muted">${wizardState.template === "custom" ? "自定义模板" : "内置模板"}</div>
        </div>
        <div class="mb-3">
          <div class="fw-semibold">参数配置</div>
          <div class="text-muted">共 6 项参数配置，已完成校验。</div>
        </div>
        <div class="alert alert-info">确认后将提交创建请求，并进入审批流程。</div>
      `;
      return container;
    };

    const renderEditParams = () => {
      const body = byId("editParamsBody");
      body.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">节点数</label>
            <input class="form-control" value="3" />
          </div>
          <div class="col-md-6">
            <label class="form-label">SKU</label>
            <input class="form-control" value="Standard_D4s_v5" />
          </div>
          <div class="col-md-6">
            <label class="form-label">VNet CIDR</label>
            <input class="form-control" value="10.10.0.0/16" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Subnet CIDR</label>
            <input class="form-control" value="10.10.1.0/24" />
          </div>
        </div>
      `;
    };

    const renderEditResource = () => {
      const body = byId("editResourceBody");
      body.innerHTML = `
        <div class="mb-3">
          <div class="d-flex gap-2">
            <select class="form-select" id="editComponentSelect">
              <option value="vnet">VNet</option>
              <option value="aks">AKS</option>
              <option value="postgres">PostgreSQL</option>
            </select>
            <input class="form-control" id="editModuleName" placeholder="模块名称" />
            <button class="btn btn-primary" id="addModuleToTf">添加模块</button>
          </div>
        </div>
        <div class="row">
          <div class="col-md-4">
            <ul class="nav flex-column nav-pills" id="tfFileTabs">
              <li class="nav-item"><button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tf-main">main.tf</button></li>
              <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tf-vars">variables.tf</button></li>
            </ul>
          </div>
          <div class="col-md-8">
            <div class="tab-content">
              <div class="tab-pane fade show active" id="tf-main">
                <textarea class="form-control" rows="10">module "network" {\n  source = "./modules/network"\n}\n</textarea>
              </div>
              <div class="tab-pane fade" id="tf-vars">
                <textarea class="form-control" rows="10">variable "vnet_cidr" {\n  type = string\n}</textarea>
              </div>
            </div>
          </div>
        </div>
      `;

      const addModuleBtn = byId("addModuleToTf");
      addModuleBtn.addEventListener("click", () => {
        const moduleName = byId("editModuleName").value.trim();
        if (!moduleName) {
          return;
        }
        const newTabId = `tf-${moduleName}`;
        const tabList = byId("tfFileTabs");
        const tabItem = document.createElement("li");
        tabItem.className = "nav-item";
        tabItem.innerHTML = `<button class="nav-link" data-bs-toggle="pill" data-bs-target="#${newTabId}">${moduleName}.tf</button>`;
        tabList.appendChild(tabItem);

        const tabContent = tabList.closest(".row").querySelector(".tab-content");
        const pane = document.createElement("div");
        pane.className = "tab-pane fade";
        pane.id = newTabId;
        pane.innerHTML = `<textarea class="form-control" rows="10">variable "${moduleName}" {\n  type = string\n}</textarea>`;
        tabContent.appendChild(pane);
        byId("editModuleName").value = "";
      });
    };

    const renderApprovalModal = (mode) => {
      const body = byId("approvalBody");
      body.innerHTML = `
        <div class="mb-3">${resources[activeEnv].env} 云资源请求待${mode}。</div>
        <ol class="list-group list-group-numbered">
          <li class="list-group-item">一级审批：项目负责人</li>
          <li class="list-group-item">二级审批：云平台治理</li>
          <li class="list-group-item">三级审批：安全负责人</li>
        </ol>
      `;
      pendingAction = mode === "批准" ? "approve" : "reject";
    };

    const showLogs = () => {
      const content = `2026-01-21 10:32:11 [INFO] 开始处理请求\n2026-01-21 10:32:30 [INFO] 执行 Terraform apply\n2026-01-21 10:33:45 [INFO] 资源部署中...\n2026-01-21 10:34:10 [INFO] 状态同步完成`;
      byId("logContent").textContent = content;
      logModal.show();
    };

    const openConfirm = (title, bodyHtml, onConfirm) => {
      byId("confirmTitle").textContent = title;
      byId("confirmBody").innerHTML = bodyHtml;
      const confirmActionBtn = byId("confirmActionBtn");
      const handler = () => {
        onConfirm?.();
        confirmActionBtn.removeEventListener("click", handler);
        confirmModal.hide();
      };
      confirmActionBtn.addEventListener("click", handler);
      confirmModal.show();
    };

    byId("wizardPrevBtn").addEventListener("click", () => {
      if (wizardState.step > 1) {
        wizardState.step -= 1;
        renderWizard();
      }
    });

    byId("wizardNextBtn").addEventListener("click", () => {
      if (wizardState.step < 4) {
        wizardState.step += 1;
        renderWizard();
        return;
      }
      resources[activeEnv].status = "pending-create";
      wizardModal.hide();
      renderAllCloudTiles();
    });

    byId("saveParamsBtn").addEventListener("click", () => {
      resources[activeEnv].status = "pending-edit";
      editParamsModal.hide();
      renderAllCloudTiles();
    });

    byId("saveResourceBtn").addEventListener("click", () => {
      resources[activeEnv].status = "pending-edit";
      editResourceModal.hide();
      renderAllCloudTiles();
    });

    byId("approveBtn").addEventListener("click", () => {
      if (pendingAction === "approve") {
        resources[activeEnv].status = "deploying";
        approvalModal.hide();
        renderAllCloudTiles();
      }
    });

    byId("rejectBtn").addEventListener("click", () => {
      if (pendingAction === "reject") {
        const previousStatus = resources[activeEnv].status;
        resources[activeEnv].status = previousStatus === "pending-edit" ? "created" : "not-created";
        approvalModal.hide();
        renderAllCloudTiles();
      }
    });

    renderCodeRepoTile();
    renderImageRepoTile();
    renderAllCloudTiles();
  }
})();
