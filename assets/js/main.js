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

const appResources = {
    'NeoChem ERP': [
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
    'NeoChem ESG Portal': [
        { name: 'rg-neochem-esg', type: '资源组', status: '待创建', cost: '预估 ¥ 0' },
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
            { name: 'Zhao Yun', email: 'zhaoyun@neochem.cn', tenant: 'NeoChem' },
            { name: 'Li Lei', email: 'lilei@agrifuture.cn', tenant: 'AgriFuture' },
            { name: 'Wang Fang', email: 'wangfang@biocloud.cn', tenant: 'BioTech Labs' }
        ]
    },
    'App Admins': {
        description: '应用管理员，具备应用管理的权限，可以批准应用的申请',
        users: [
            { name: 'Liu Yang', email: 'liuyang@apps.cn', tenant: 'NeoChem' },
            { name: 'Qin Mei', email: 'qinmei@apps.cn', tenant: 'AgriFuture' }
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
            { name: 'Chen Yu', email: 'chenyu@neochem.cn', tenant: 'NeoChem' },
            { name: 'Gao Ling', email: 'gaoling@agrifuture.cn', tenant: 'AgriFuture' },
            { name: 'Luo Bin', email: 'luobin@biocloud.cn', tenant: 'BioTech Labs' }
        ]
    },
    'Tenant Users': {
        description: '租户使用者，可以访问所在租户的应用，包括知识库问答',
        users: [
            { name: 'Sun Tao', email: 'suntao@neochem.cn', tenant: 'NeoChem' },
            { name: 'Ma Rui', email: 'marui@agrifuture.cn', tenant: 'AgriFuture' },
            { name: 'He Na', email: 'hena@biocloud.cn', tenant: 'BioTech Labs' },
            { name: 'Feng Kai', email: 'fengkai@biocloud.cn', tenant: 'BioTech Labs' }
        ]
    }
};

const tenantUserRoles = ['租户拥有者', '租户使用者'];
const tenantUsersDirectory = {
    NeoChem: [
        { name: 'Chen Yu', email: 'chenyu@neochem.cn', role: '租户拥有者' },
        { name: 'Sun Tao', email: 'suntao@neochem.cn', role: '租户使用者' }
    ],
    AgriFuture: [
        { name: 'Gao Ling', email: 'gaoling@agrifuture.cn', role: '租户拥有者' },
        { name: 'Ma Rui', email: 'marui@agrifuture.cn', role: '租户使用者' }
    ],
    'BioTech Labs': [
        { name: 'Luo Bin', email: 'luobin@biocloud.cn', role: '租户拥有者' },
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
            const isPendingApproval = row.dataset.status === 'pending';
            resourceLabel.textContent = isPendingApproval ? `${appName} 的拟创建资源` : `${appName} 的资源`;
            renderResourceTable(resourceTableBody, appResources[appName], { isPendingApproval });
        });

        const approveBtn = row.querySelector('[data-action="approve-app"]');
        if (approveBtn) {
            approveBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const appName = row.dataset.app || '该应用';
                if (confirm(`确认批准"${appName}"的创建申请？`)) {
                    alert('已提交批准，系统将开始部署流程。');
                }
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
    initTenantUsersModal();
    bootstrapDefaultTabs();
});
