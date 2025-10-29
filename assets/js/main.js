const tabBar = document.getElementById('tabBar');
const tabContent = document.getElementById('tabContent');
const mainNav = document.getElementById('mainNav');
const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatForm = document.getElementById('chatForm');
const chatMessages = document.getElementById('chatMessages');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const applicationTenantSelectorTemplateId = 'applicationTenantSelector';

const APPROVAL_STATUS_VARIANTS = {
    pending: { label: '待处理', className: 'bg-secondary' },
    inProgress: { label: '审批中...', className: 'bg-info text-dark' },
    approved: { label: '已批准', className: 'bg-success' },
    rejected: { label: '已拒绝', className: 'bg-danger' }
};

const APPROVAL_STEP_DELAY = 900;

const approvalState = {
    currentRow: null,
    flow: [],
    stepElements: [],
    timers: [],
    status: 'idle'
};

let approvalModalElements = null;
let approvalModalInstance = null;

function initializeApprovalModal() {
    if (approvalModalElements) return;
    const modalElement = document.getElementById('appApprovalProgressModal');
    if (!modalElement || typeof bootstrap === 'undefined') return;

    approvalModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    approvalModalElements = {
        modal: modalElement,
        appName: modalElement.querySelector('[data-role="approval-app-name"]'),
        tenantName: modalElement.querySelector('[data-role="approval-tenant-name"]'),
        stepsContainer: modalElement.querySelector('[data-role="approval-steps"]'),
        feedback: modalElement.querySelector('[data-role="approval-feedback"]'),
        confirmBtn: modalElement.querySelector('[data-action="approval-confirm"]'),
        rejectBtn: modalElement.querySelector('[data-action="approval-reject"]')
    };

    approvalModalElements.confirmBtn?.addEventListener('click', startApprovalFlow);
    approvalModalElements.rejectBtn?.addEventListener('click', handleApprovalReject);
    modalElement.addEventListener('hidden.bs.modal', resetApprovalModal);
}

function resolveApprovalFlow(tenantName = '') {
    const tenantOwner = getTenantUsers(tenantName).find(user => user.role === '租户所有者') || {};
    const appAdmins = (roleAssignments['App Admins']?.users || []);
    const platformAdmins = (roleAssignments['Platform Admins']?.users || []);

    const appAdmin = appAdmins.find(user => user.tenant === tenantName) || appAdmins[0] || {};
    const platformAdmin = platformAdmins[0] || {};

    return [
        {
            level: 1,
            role: '租户所有者',
            title: '1级 审批 - 租户所有者',
            contactName: tenantOwner.name || '未配置',
            contactEmail: tenantOwner.email || '--'
        },
        {
            level: 2,
            role: '应用管理员',
            title: '2级 审批 - 应用管理员',
            contactName: appAdmin.name || '未配置',
            contactEmail: appAdmin.email || '--'
        },
        {
            level: 3,
            role: '平台管理员',
            title: '3级 审批 - 平台管理员',
            contactName: platformAdmin.name || '未配置',
            contactEmail: platformAdmin.email || '--'
        }
    ];
}

function renderApprovalSteps(container, flow = []) {
    if (!container) return;
    container.innerHTML = '';
    approvalState.stepElements = [];

    flow.forEach(step => {
        const item = document.createElement('li');
        item.className = 'list-group-item';
        item.classList.add('approval-step');
        item.dataset.level = step.level;

    const detail = document.createElement('div');
    detail.className = 'me-3';
    detail.classList.add('flex-grow-1');

        const title = document.createElement('div');
        title.className = 'fw-semibold';
        title.textContent = step.title || `${step.level}级 审批 - ${step.role}`;

        const info = document.createElement('div');
        info.className = 'small';
        info.textContent = step.contactName && step.contactEmail ? `${step.contactName} · ${step.contactEmail}` : '未配置审批人';

        detail.appendChild(title);
        detail.appendChild(info);

        const badge = document.createElement('span');
        badge.className = `badge rounded-pill ${APPROVAL_STATUS_VARIANTS.pending.className}`;
        badge.textContent = APPROVAL_STATUS_VARIANTS.pending.label;

        item.appendChild(detail);
        item.appendChild(badge);
        container.appendChild(item);

        approvalState.stepElements.push({
            level: step.level,
            element: item,
            badge
        });
    });
}

function setStepStatus(level, statusKey) {
    const entry = approvalState.stepElements.find(step => Number(step.level) === Number(level));
    if (!entry) return;

    const variant = APPROVAL_STATUS_VARIANTS[statusKey] || APPROVAL_STATUS_VARIANTS.pending;
    entry.badge.className = `badge rounded-pill ${variant.className}`;
    entry.badge.textContent = variant.label;

    if (statusKey === 'inProgress') {
        entry.element.classList.add('active');
    } else {
        entry.element.classList.remove('active');
    }
}

function clearApprovalTimers() {
    approvalState.timers.forEach(timerId => clearTimeout(timerId));
    approvalState.timers = [];
}

function openApprovalModal(row) {
    initializeApprovalModal();
    if (!approvalModalElements || !approvalModalInstance) return;

    approvalState.currentRow = row;
    const tenantName = row.dataset.tenant || '';
    const appName = row.dataset.app || '应用';

    if (approvalModalElements.appName) {
        approvalModalElements.appName.textContent = appName;
    }
    if (approvalModalElements.tenantName) {
        approvalModalElements.tenantName.textContent = tenantName ? `租户：${tenantName}` : '';
    }

    approvalState.flow = resolveApprovalFlow(tenantName);
    renderApprovalSteps(approvalModalElements.stepsContainer, approvalState.flow);

    approvalState.status = row.dataset.status || 'pending';

    if (approvalModalElements.feedback) {
        approvalModalElements.feedback.textContent = '发起审批后将依次完成每级审批。';
    }

    if (approvalModalElements.confirmBtn) {
        approvalModalElements.confirmBtn.disabled = false;
        approvalModalElements.confirmBtn.textContent = '批准';
    }

    if (approvalModalElements.rejectBtn) {
        approvalModalElements.rejectBtn.disabled = false;
        approvalModalElements.rejectBtn.textContent = '拒绝';
    }

    if (approvalState.status === 'approved') {
        approvalState.flow.forEach(step => setStepStatus(step.level, 'approved'));
        if (approvalModalElements.feedback) {
            approvalModalElements.feedback.textContent = '该申请已完成审批。';
        }
        if (approvalModalElements.confirmBtn) {
            approvalModalElements.confirmBtn.disabled = true;
            approvalModalElements.confirmBtn.textContent = '已批准';
        }
        if (approvalModalElements.rejectBtn) {
            approvalModalElements.rejectBtn.disabled = true;
        }
    } else if (approvalState.status === 'rejected') {
        if (approvalState.flow[0]) {
            setStepStatus(approvalState.flow[0].level, 'rejected');
        }
        if (approvalModalElements.feedback) {
            approvalModalElements.feedback.textContent = '该申请已被拒绝。';
        }
        if (approvalModalElements.confirmBtn) {
            approvalModalElements.confirmBtn.disabled = true;
            approvalModalElements.confirmBtn.textContent = '已拒绝';
        }
        if (approvalModalElements.rejectBtn) {
            approvalModalElements.rejectBtn.disabled = true;
        }
    }

    approvalModalInstance.show();
}

function startApprovalFlow() {
    if (!approvalModalElements || !approvalState.currentRow) return;
    if (approvalState.status === 'processing' || approvalState.status === 'approved') return;

    clearApprovalTimers();

    approvalState.status = 'processing';
    approvalState.flow.forEach((step, index) => {
        setStepStatus(step.level, index === 0 ? 'inProgress' : 'pending');
    });

    if (approvalModalElements.feedback) {
        approvalModalElements.feedback.textContent = '正在推进审批流程...';
    }

    if (approvalModalElements.confirmBtn) {
        approvalModalElements.confirmBtn.disabled = true;
        approvalModalElements.confirmBtn.textContent = '审批中...';
    }

    if (approvalModalElements.rejectBtn) {
        approvalModalElements.rejectBtn.disabled = true;
    }

    approvalState.flow.forEach((step, index) => {
        const timerId = setTimeout(() => {
            setStepStatus(step.level, 'approved');
            if (index < approvalState.flow.length - 1) {
                const nextStep = approvalState.flow[index + 1];
                setStepStatus(nextStep.level, 'inProgress');
            } else {
                finalizeApprovalSuccess();
            }
        }, (index + 1) * APPROVAL_STEP_DELAY);

        approvalState.timers.push(timerId);
    });
}

function finalizeApprovalSuccess() {
    approvalState.status = 'approved';
    if (approvalModalElements.feedback) {
        approvalModalElements.feedback.textContent = '审批完成，系统已记录批准结果。';
    }
    if (approvalModalElements.confirmBtn) {
        approvalModalElements.confirmBtn.disabled = true;
        approvalModalElements.confirmBtn.textContent = '已批准';
    }
    if (approvalModalElements.rejectBtn) {
        approvalModalElements.rejectBtn.disabled = true;
    }
    updateApplicationRowStatus('approved');
}

function handleApprovalReject() {
    if (!approvalModalElements || !approvalState.currentRow) return;

    clearApprovalTimers();
    approvalState.status = 'rejected';

    approvalState.flow.forEach((step, index) => {
        const statusKey = index === 0 ? 'rejected' : 'pending';
        setStepStatus(step.level, statusKey);
    });

    if (approvalModalElements.feedback) {
        approvalModalElements.feedback.textContent = '已拒绝该申请，资源创建不会继续。';
    }
    if (approvalModalElements.confirmBtn) {
        approvalModalElements.confirmBtn.disabled = true;
        approvalModalElements.confirmBtn.textContent = '已拒绝';
    }
    if (approvalModalElements.rejectBtn) {
        approvalModalElements.rejectBtn.disabled = true;
    }

    updateApplicationRowStatus('rejected');
}

function updateApplicationRowStatus(status) {
    const row = approvalState.currentRow;
    if (!row) return;

    row.dataset.status = status;

    const statusBadge = row.querySelector('[data-role="deployment-status"]');
    if (statusBadge) {
        if (status === 'approved') {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = '已批准';
        } else if (status === 'rejected') {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = '已拒绝';
        } else {
            statusBadge.className = 'badge bg-info text-dark';
            statusBadge.textContent = '待批准';
        }
    }

    const approveBtn = row.querySelector('[data-action="approve-app"]');
    if (approveBtn) {
        if (status === 'approved') {
            approveBtn.textContent = '已批准';
            approveBtn.classList.remove('btn-outline-success');
            approveBtn.classList.remove('btn-outline-secondary');
            approveBtn.classList.add('btn-success');
            approveBtn.disabled = true;
        } else if (status === 'rejected') {
            approveBtn.textContent = '已拒绝';
            approveBtn.classList.remove('btn-outline-success');
            approveBtn.classList.remove('btn-success');
            approveBtn.classList.add('btn-outline-secondary');
            approveBtn.disabled = true;
        } else {
            approveBtn.textContent = '批准';
            approveBtn.classList.remove('btn-success', 'btn-outline-secondary');
            approveBtn.classList.add('btn-outline-success');
            approveBtn.disabled = false;
        }
    }
}

function resetApprovalModal() {
    clearApprovalTimers();
    approvalState.currentRow = null;
    approvalState.flow = [];
    approvalState.stepElements = [];
    approvalState.status = 'idle';

    if (!approvalModalElements) return;

    if (approvalModalElements.stepsContainer) {
        approvalModalElements.stepsContainer.innerHTML = '';
    }
    if (approvalModalElements.feedback) {
        approvalModalElements.feedback.textContent = '';
    }
    if (approvalModalElements.appName) {
        approvalModalElements.appName.textContent = '--';
    }
    if (approvalModalElements.tenantName) {
        approvalModalElements.tenantName.textContent = '';
    }
    if (approvalModalElements.confirmBtn) {
        approvalModalElements.confirmBtn.disabled = false;
        approvalModalElements.confirmBtn.textContent = '批准';
    }
    if (approvalModalElements.rejectBtn) {
        approvalModalElements.rejectBtn.disabled = false;
        approvalModalElements.rejectBtn.textContent = '拒绝';
    }
}

const appResources = {
    'RG-default ERP': [
        { name: 'vm-erp-prod-01', type: '虚拟机', status: '运行', cost: '¥ 3,120' },
        { name: 'db-erp-prod-02', type: '数据库', status: '运行', cost: '¥ 5,680' },
        { name: 'storage-erp-archive', type: '存储', status: '待机', cost: '¥ 1,240' },
        { name: 'redis-erp-cache', type: '缓存', status: '运行', cost: '¥ 960' }
    ],
    'Agri AI Insights': [
        { name: 'aks-ai-cluster', type: '容器服务', status: '部署中', cost: '¥ 7,410' },
        { name: 'ds-ai-data-lake', type: 'Data Lake', status: '警告', cost: '¥ 4,560' },
        { name: 'func-ai-event', type: '函数', status: '运行', cost: '¥ 860' }
    ],
    'RG-default ESG Portal': [
        { name: 'rg-RG-default-esg', type: '资源组', status: '待创建', cost: '预估 ¥ 0' },
        { name: 'aks-esg-cluster', type: '容器服务', status: '待创建', cost: '预估 ¥ 9,500' },
        { name: 'db-esg-analytics', type: '数据库', status: '待创建', cost: '预估 ¥ 6,800' },
        { name: 'app-esg-api', type: '应用服务', status: '待创建', cost: '预估 ¥ 2,600' }
    ],
    'BioCloud LIMS': [
        { name: 'vm-lims-prod-01', type: '虚拟机', status: '运行', cost: '¥ 2,980' },
        { name: 'sql-lims-prod', type: '数据库', status: '运行', cost: '¥ 6,340' },
        { name: 'func-lims-automation', type: '函数', status: '运行', cost: '¥ 1,240' }
    ]
};

const roleAssignments = {
    'Platform Admins': {
        description: '平台管理员，具备最高的权限',
        users: [
            { name: 'Admin User', email: 'admin@rd-digital.com', tenant: 'Platform' },
            { name: 'Liang Chen', email: 'liang.chen@rd-digital.com', tenant: 'Platform' }
        ]
    },
    'Tenant Admins': {
        description: '租户管理员，具备租户管理的权限',
        users: [
            { name: 'Zhao Yun', email: 'zhaoyun@RG-default.cn', tenant: 'RG-default' },
            { name: 'Li Lei', email: 'lilei@EV-default.cn', tenant: 'EV-default' },
            { name: 'Wang Fang', email: 'wangfang@biocloud.cn', tenant: 'ED-default' }
        ]
    },
    'App Admins': {
        description: '应用管理员，具备应用管理的权限，可以批准应用的申请',
        users: [
            { name: 'Liu Yang', email: 'liuyang@apps.cn', tenant: 'RG-default' },
            { name: 'Qin Mei', email: 'qinmei@apps.cn', tenant: 'EV-default' }
        ]
    },
    'Template Admins': {
        description: '应用模板管理员，具备模板管理的权限',
        users: [
            { name: 'Zhang Wei', email: 'zhangwei@rd-digital.com', tenant: 'Platform' },
            { name: 'Hou Min', email: 'houmin@rd-digital.com', tenant: 'Platform' }
        ]
    },
    'Tenant Owners': {
        description: '租户所有者，可以对所在租户进行完全的管理',
        users: [
            { name: 'Chen Yu', email: 'chenyu@RG-default.cn', tenant: 'RG-default' },
            { name: 'Gao Ling', email: 'gaoling@EV-default.cn', tenant: 'EV-default' },
            { name: 'Luo Bin', email: 'luobin@biocloud.cn', tenant: 'ED-default' }
        ]
    },
    'Tenant Users': {
        description: '租户使用者，可以访问所在租户的应用，包括知识库问答',
        users: [
            { name: 'Sun Tao', email: 'suntao@RG-default.cn', tenant: 'RG-default' },
            { name: 'Ma Rui', email: 'marui@EV-default.cn', tenant: 'EV-default' },
            { name: 'He Na', email: 'hena@biocloud.cn', tenant: 'ED-default' },
            { name: 'Feng Kai', email: 'fengkai@biocloud.cn', tenant: 'ED-default' }
        ]
    }
};

const tenantUserRoles = ['租户所有者', '租户使用者'];
const tenantUsersDirectory = {
    'RG-default': [
        { name: 'Chen Yu', email: 'chenyu@RG-default.cn', role: '租户所有者' },
        { name: 'Sun Tao', email: 'suntao@RG-default.cn', role: '租户使用者' }
    ],
    'EV-default': [
        { name: 'Gao Ling', email: 'gaoling@EV-default.cn', role: '租户所有者' },
        { name: 'Ma Rui', email: 'marui@EV-default.cn', role: '租户使用者' }
    ],
    'ED-default': [
        { name: 'Luo Bin', email: 'luobin@biocloud.cn', role: '租户所有者' },
        { name: 'He Na', email: 'hena@biocloud.cn', role: '租户使用者' }
    ]
};

function createTabId(page) {
    return `tab-${page}`;
}

function setActiveNav(page) {
    const links = mainNav.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
}

function openTab(page, title, payload = {}) {
    const tabId = createTabId(page);
    const existingTab = tabBar.querySelector(`[data-bs-target="#${tabId}"]`);

    if (existingTab) {
        const tabTrigger = bootstrap.Tab.getOrCreateInstance(existingTab);
        tabTrigger.show();
        setActiveNav(page);
        if (page === 'applications' && payload.tenant) {
            setTimeout(() => selectTenantInApplications(payload.tenant, payload.app), 150);
        }
        return;
    }

    const template = document.getElementById(`page-${page}`);
    if (!template) return;

    // 创建 Tab 按钮
    const tabItem = document.createElement('li');
    tabItem.classList.add('nav-item');

    const tabButton = document.createElement('button');
    tabButton.classList.add('nav-link');
    tabButton.setAttribute('data-bs-toggle', 'tab');
    tabButton.setAttribute('data-bs-target', `#${tabId}`);
    tabButton.setAttribute('type', 'button');
    tabButton.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('tab-close');
    closeBtn.setAttribute('type', 'button');
    closeBtn.innerHTML = '<i class="bi bi-x"></i>';
    tabButton.appendChild(closeBtn);

    tabItem.appendChild(tabButton);
    tabBar.appendChild(tabItem);

    // 创建内容
    const tabPane = document.createElement('div');
    tabPane.classList.add('tab-pane', 'fade');
    tabPane.setAttribute('id', tabId);
    tabPane.setAttribute('role', 'tabpanel');
    tabPane.innerHTML = '';
    tabPane.appendChild(template.content.cloneNode(true));

    tabContent.appendChild(tabPane);

    // 激活新 Tab
    const newTab = bootstrap.Tab.getOrCreateInstance(tabButton);
    newTab.show();

    setActiveNav(page);

    // 额外初始化逻辑
    if (page === 'applications') {
        initializeApplicationsTab(tabPane, payload);
    } else if (page === 'roles') {
        initializeRolesTab(tabPane);
    }
}

function initializeApplicationsTab(container, payload) {
    initializeApprovalModal();

    const tenantSelector = container.querySelector(`#${applicationTenantSelectorTemplateId}`);
    const appRows = container.querySelectorAll('#applicationsTable tbody tr');
    const resourceTableBody = container.querySelector('#resourceTable tbody');
    const resourceLabel = container.querySelector('#resourceAppLabel');

    if (!tenantSelector || !resourceTableBody) return;

    tenantSelector.addEventListener('change', () => {
        resourceTableBody.innerHTML = '<tr class="placeholder-row"><td colspan="4" class="text-center text-muted">选择一个应用以加载资源...</td></tr>';
        resourceLabel.textContent = tenantSelector.value ? `${tenantSelector.value} - 已加载应用` : '请选择应用查看资源';
    });

    appRows.forEach(row => {
        row.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            const appName = row.dataset.app;
            if (!appName) return;
            const status = row.dataset.status || '';
            if (status === 'rejected') {
                resourceLabel.textContent = `${appName} 的资源`;
                resourceTableBody.innerHTML = '<tr class="placeholder-row"><td colspan="4" class="text-center text-muted">审批未通过，资源未创建。</td></tr>';
                return;
            }
            const isPendingApproval = status === 'pending';
            resourceLabel.textContent = isPendingApproval ? `${appName} 的拟创建资源` : `${appName} 的资源`;
            renderResourceTable(resourceTableBody, appResources[appName], { isPendingApproval });
        });

        const approveBtn = row.querySelector('[data-action="approve-app"]');
        if (approveBtn) {
            approveBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                openApprovalModal(row);
            });
        }
    });

    if (payload.tenant) {
        tenantSelector.value = payload.tenant;
        resourceLabel.textContent = `${payload.tenant} - 已加载应用`;
    }

    if (payload.app) {
        const targetRow = Array.from(appRows).find(row => row.dataset.app === payload.app);
        if (targetRow) {
            targetRow.click();
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function selectTenantInApplications(tenant, app) {
    const tabPane = document.getElementById(createTabId('applications'));
    if (!tabPane) return;

    const tenantSelector = tabPane.querySelector(`#${applicationTenantSelectorTemplateId}`);
    const appRows = tabPane.querySelectorAll('#applicationsTable tbody tr');

    if (tenantSelector) {
        tenantSelector.value = tenant;
    }

    if (app) {
        const targetRow = Array.from(appRows).find(row => row.dataset.app === app);
        if (targetRow) {
            targetRow.click();
            targetRow.classList.add('table-active');
            setTimeout(() => targetRow.classList.remove('table-active'), 1500);
        }
    }
}

function renderResourceTable(tbody, resources = [], options = {}) {
    const { isPendingApproval = false } = options;

    if (!resources || resources.length === 0) {
        const message = isPendingApproval ? '审批通过后将创建资源清单。' : '暂无资源信息';
        tbody.innerHTML = `<tr class="placeholder-row"><td colspan="4" class="text-center text-muted">${message}</td></tr>`;
        return;
    }

    const statusClassMap = {
        '运行': 'bg-success',
        '警告': 'bg-warning text-dark',
        '部署中': 'bg-warning text-dark',
        '待机': 'bg-secondary',
        '待创建': 'bg-info text-dark'
    };

    const infoRow = isPendingApproval ? '<tr class="table-info"><td colspan="4" class="text-muted">以下资源将在批准后自动创建。</td></tr>' : '';

    const resourceRows = resources
        .map(resource => {
            const statusClass = statusClassMap[resource.status] || 'bg-secondary';
            const cost = isPendingApproval ? (resource.cost || '--') : '--';
            return `
            <tr>
                <td>${resource.name}</td>
                <td>${resource.type}</td>
                <td>
                    <span class="badge ${statusClass}">${resource.status}</span>
                </td>
                <td>${cost}</td>
            </tr>
        `;
        })
        .join('');

    tbody.innerHTML = infoRow + resourceRows;
}

function renderRoleUsers(tbody, users = []) {
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr class="placeholder-row"><td colspan="3" class="text-center text-muted">当前角色未分配用户</td></tr>';
        return;
    }

    tbody.innerHTML = users
        .map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.tenant || '--'}</td>
            </tr>
        `)
        .join('');
}

function getTenantUsers(tenantName) {
    if (!tenantName) return [];
    if (!tenantUsersDirectory[tenantName]) {
        tenantUsersDirectory[tenantName] = [];
    }
    return tenantUsersDirectory[tenantName];
}

function renderTenantUsersTable(tbody, tenantName) {
    if (!tbody) return;
    const users = getTenantUsers(tenantName);

    if (users.length === 0) {
        tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4" class="text-center text-muted">当前租户暂无成员</td></tr>';
        return;
    }

    tbody.innerHTML = users
        .map((user, index) => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" data-action="remove-tenant-user" data-index="${index}">移除</button>
                </td>
            </tr>
        `)
        .join('');
}

function initializeRolesTab(container) {
    const roleList = container.querySelector('#roleList');
    const roleTitle = container.querySelector('#roleUserTitle');
    const roleDescription = container.querySelector('#roleDescription');
    const userTableBody = container.querySelector('#roleUsersTable tbody');

    if (!roleList || !roleTitle || !roleDescription || !userTableBody) return;

    roleList.innerHTML = '';
    const roles = Object.entries(roleAssignments);

    if (roles.length === 0) {
        roleList.innerHTML = '<div class="list-group-item">暂无系统角色</div>';
        renderRoleUsers(userTableBody, []);
        roleTitle.textContent = '无可用角色';
        roleDescription.textContent = '系统尚未配置内置角色。';
        return;
    }

    roles.forEach(([roleName, roleInfo], index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        button.dataset.role = roleName;
        button.innerHTML = `<span>${roleName}</span><span class="badge bg-secondary">${roleInfo.users.length}</span>`;
        if (index === 0) {
            button.classList.add('active');
            roleTitle.textContent = roleName;
            roleDescription.textContent = roleInfo.description || '此角色暂无说明。';
            renderRoleUsers(userTableBody, roleInfo.users);
        }
        roleList.appendChild(button);
    });

    roleList.addEventListener('click', event => {
        const target = event.target.closest('.list-group-item-action');
        if (!target || target.classList.contains('active')) return;

        roleList.querySelectorAll('.list-group-item-action').forEach(item => item.classList.remove('active'));
        target.classList.add('active');

        const roleName = target.dataset.role;
        const roleInfo = roleAssignments[roleName];
        if (!roleInfo) return;

        roleTitle.textContent = roleName;
        roleDescription.textContent = roleInfo.description || '此角色暂无说明。';
        renderRoleUsers(userTableBody, roleInfo.users);
    });
}

function initTenantUsersModal() {
    const modalElement = document.getElementById('tenantUsersModal');
    if (!modalElement) return;

    const modalTitle = modalElement.querySelector('#tenantUsersModalLabel');
    const tenantLabel = modalElement.querySelector('#tenantUsersModalTenant');
    const tableBody = modalElement.querySelector('#tenantUsersTableBody');
    const feedback = modalElement.querySelector('#tenantUsersFeedback');
    const form = modalElement.querySelector('#tenantUsersForm');
    const roleSelect = modalElement.querySelector('#tenantUserRole');
    let currentTenant = '';

    const setFeedback = (message, isError = false) => {
        feedback.textContent = message;
        feedback.classList.toggle('text-danger', isError);
        feedback.classList.toggle('text-success', !isError);
    };

    modalElement.addEventListener('show.bs.modal', event => {
        const trigger = event.relatedTarget;
        currentTenant = trigger?.dataset.tenant || '';
        tenantLabel.textContent = currentTenant || '未选择租户';
        modalTitle.textContent = currentTenant ? `租户用户管理 - ${currentTenant}` : '租户用户管理';
        form.reset();
        roleSelect.value = tenantUserRoles[0];
        setFeedback('');
        renderTenantUsersTable(tableBody, currentTenant);
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!currentTenant) return;

        const formData = new FormData(form);
        const name = (formData.get('name') || '').trim();
        const email = (formData.get('email') || '').trim();
        const role = formData.get('role');

        if (!name || !email || !role) return;

        const users = getTenantUsers(currentTenant);
        const exists = users.some(user => user.email.toLowerCase() === email.toLowerCase());
        if (exists) {
            setFeedback('该邮箱已存在，无需重复添加。', true);
            return;
        }

        // Persist mock user assignments per tenant for demo interactions.
        users.push({ name, email, role });
        renderTenantUsersTable(tableBody, currentTenant);
        form.reset();
    roleSelect.value = tenantUserRoles[0];
        setFeedback(`已添加 ${name} (${role})`);
    });

    tableBody.addEventListener('click', event => {
        const removeBtn = event.target.closest('[data-action="remove-tenant-user"]');
        if (!removeBtn || !currentTenant) return;

        const index = Number(removeBtn.dataset.index);
        const users = getTenantUsers(currentTenant);

        if (Number.isInteger(index) && index >= 0 && index < users.length) {
            const [removed] = users.splice(index, 1);
            renderTenantUsersTable(tableBody, currentTenant);
            setFeedback(removed ? `已移除 ${removed.name}` : '');
        }
    });
}

function initTenantFormModal() {
    const modalElement = document.getElementById('tenantFormModal');
    if (!modalElement || typeof bootstrap === 'undefined') return;

    const modalTitle = modalElement.querySelector('[data-role="tenant-modal-title"]');
    const modalHint = modalElement.querySelector('[data-role="tenant-modal-hint"]');
    const feedback = modalElement.querySelector('[data-role="tenant-modal-feedback"]');
    const submitBtn = modalElement.querySelector('[data-role="tenant-modal-submit"]');
    const form = modalElement.querySelector('#tenantForm');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);

    if (!form) return;

    const fields = {
        code: form.querySelector('#tenantCode'),
        name: form.querySelector('#tenantName'),
        od: form.querySelector('#tenantOd'),
        owner: form.querySelector('#tenantOwner'),
        description: form.querySelector('#tenantDescription')
    };

    const setFeedback = (message, variant) => {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.toggle('d-none', !message);
        feedback.classList.toggle('alert-success', variant === 'success');
        feedback.classList.toggle('alert-warning', variant === 'warning');
    };

    const enableAllFields = () => {
        Object.values(fields).forEach(input => {
            if (input) input.disabled = false;
        });
    };

    const disableImmutableFields = () => {
        ['code', 'od', 'owner'].forEach(key => {
            if (fields[key]) fields[key].disabled = true;
        });
    };

    modalElement.addEventListener('show.bs.modal', event => {
        const trigger = event.relatedTarget;
        const mode = trigger?.dataset.mode === 'edit' ? 'edit' : 'create';

        form.reset();
        enableAllFields();
        setFeedback('');

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'edit' ? '保存' : '创建';
        }

        if (modalTitle) {
            modalTitle.textContent = mode === 'edit' ? '编辑租户' : '新增租户';
        }

        if (modalHint) {
            modalHint.textContent = mode === 'edit' ? '仅支持更新租户名称与描述。' : '请填写完整租户信息以创建新租户。';
            modalHint.classList.toggle('alert-warning', mode === 'edit');
            modalHint.classList.toggle('alert-info', mode !== 'edit');
        }

        if (mode === 'edit') {
            const sourceRow = trigger?.closest('tr');
            const dataset = sourceRow?.dataset || {};

            if (fields.code) fields.code.value = dataset.tenantCode || '';
            if (fields.name) fields.name.value = dataset.tenantName || '';
            if (fields.od) fields.od.value = dataset.tenantOd || '';
            if (fields.owner) fields.owner.value = dataset.tenantOwner || '';
            if (fields.description) fields.description.value = dataset.tenantDescription || '';

            disableImmutableFields();
        }

        form.dataset.mode = mode;
    });

    form.addEventListener('submit', event => {
        event.preventDefault();

        const mode = form.dataset.mode === 'edit' ? 'edit' : 'create';
        const formData = new FormData(form);
        const name = (formData.get('name') || '').trim();

        if (!name) {
            setFeedback('请填写租户名称。', 'warning');
            return;
        }

        setFeedback(mode === 'edit' ? '已保存租户信息（示例数据）。' : '已创建租户（示例数据）。', 'success');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = mode === 'edit' ? '已保存' : '已创建';
        }

        // Close the modal after a short pause so users can read the feedback.
        setTimeout(() => modalInstance.hide(), 600);
    });
}

function handleTabClose(event) {
    if (!event.target.closest('.tab-close')) return;
    const button = event.target.closest('[data-bs-target]');
    if (!button) return;

    const tabId = button.getAttribute('data-bs-target');
    const tabPane = document.querySelector(tabId);
    const tabItem = button.parentElement;

    const isActive = button.classList.contains('active');

    tabPane?.remove();
    tabItem?.remove();

    if (isActive) {
        const lastTabButton = tabBar.querySelector('.nav-link:last-child');
        if (lastTabButton) {
            const prevTab = bootstrap.Tab.getOrCreateInstance(lastTabButton);
            prevTab.show();
        } else {
            setActiveNav('');
        }
    }
}

function handleNavClick(event) {
    const link = event.target.closest('.nav-link');
    if (!link) return;
    event.preventDefault();

    const page = link.dataset.page;
    const title = link.textContent.trim();
    openTab(page, title);
}

function handleTenantLinkClick(event) {
    const target = event.target.closest('.tenant-link');
    if (!target) return;

    const tenantName = target.dataset.tenant;
    openTab('applications', '应用管理', { tenant: tenantName });
}

function handleAppLinkClick(event) {
    const target = event.target.closest('.app-link');
    if (!target) return;

    const appName = target.closest('tr')?.dataset.app;
    if (appName) {
        renderResourceTableFromElement(target.closest('.tab-pane'), appName);
    }
}

function renderResourceTableFromElement(tabPane, appName) {
    if (!tabPane) return;
    const resourceTableBody = tabPane.querySelector('#resourceTable tbody');
    const resourceLabel = tabPane.querySelector('#resourceAppLabel');
    if (!resourceTableBody) return;

    let isPendingApproval = false;
    const tableRows = Array.from(tabPane.querySelectorAll('#applicationsTable tbody tr'));
    const targetRow = tableRows.find(row => row.dataset.app === appName);

    if (targetRow?.dataset.status === 'pending') {
        isPendingApproval = true;
        resourceLabel.textContent = `${appName} 的拟创建资源`;
    } else {
        resourceLabel.textContent = `${appName} 的资源`;
    }

    renderResourceTable(resourceTableBody, appResources[appName], { isPendingApproval });
}

function toggleChat(open) {
    if (open === undefined) {
        chatPanel.classList.toggle('open');
    } else if (open) {
        chatPanel.classList.add('open');
    } else {
        chatPanel.classList.remove('open');
    }
}

function addChatMessage(type, text) {
    const message = document.createElement('div');
    message.className = `chat-message ${type}`;
    message.innerHTML = `
        <div class="name">${type === 'user' ? '我' : '知识助手'}</div>
        <div class="bubble">${text}</div>
    `;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function fakeChatReply(question) {
    const cannedReplies = [
        '该功能正在设计中，请查看最新的用户手册章节以获取流程指引。',
    '若需部署新应用，可在应用管理页面点击“申请应用创建”，并选择合适的模板与参数。',
        '成本报告可在租户管理页面通过“成本详情”查看或导出。'
    ];
    const reply = cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
    setTimeout(() => addChatMessage('bot', reply), 800);
}

function initChat() {
    chatToggle?.addEventListener('click', () => toggleChat());
    chatClose?.addEventListener('click', () => toggleChat(false));

    chatForm?.addEventListener('submit', event => {
        event.preventDefault();
        const input = chatForm.querySelector('input');
        if (!input?.value.trim()) return;
        addChatMessage('user', input.value.trim());
        fakeChatReply(input.value.trim());
        input.value = '';
    });
}

function initSidebar() {
    sidebarToggle?.addEventListener('click', () => sidebar?.classList.add('open'));
    sidebarCloseBtn?.addEventListener('click', () => sidebar?.classList.remove('open'));

    document.addEventListener('click', event => {
        if (!sidebar?.classList.contains('open')) return;
        if (event.target.closest('.sidebar') || event.target.closest('#sidebarToggle')) return;
        sidebar.classList.remove('open');
    });
}

function initDelegates() {
    mainNav.addEventListener('click', handleNavClick);
    tabBar.addEventListener('click', event => {
        if (event.target.closest('.tab-close')) {
            event.stopPropagation();
            handleTabClose(event);
        }
    });
    tabContent.addEventListener('click', handleTenantLinkClick);
    tabContent.addEventListener('click', handleAppLinkClick);
}

function bootstrapDefaultTabs() {
    openTab('dashboard', '首页仪表盘');
}

document.addEventListener('DOMContentLoaded', () => {
    initDelegates();
    initChat();
    initSidebar();
    initTenantFormModal();
    initTenantUsersModal();
    bootstrapDefaultTabs();
});
