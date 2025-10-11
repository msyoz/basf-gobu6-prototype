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
    'BioCloud LIMS': [
        { name: 'vm-lims-prod-01', type: '虚拟机', status: '运行', cost: '¥ 2,980' },
        { name: 'sql-lims-prod', type: '数据库', status: '运行', cost: '¥ 6,340' },
        { name: 'func-lims-automation', type: '函数', status: '运行', cost: '¥ 1,240' }
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
        row.addEventListener('click', () => {
            const appName = row.dataset.app;
            if (!appName) return;
            resourceLabel.textContent = `${appName} 的资源`;
            renderResourceTable(resourceTableBody, appResources[appName]);
        });
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

function renderResourceTable(tbody, resources = []) {
    if (!resources || resources.length === 0) {
        tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4" class="text-center text-muted">暂无资源信息</td></tr>';
        return;
    }

    tbody.innerHTML = resources
        .map(resource => `
            <tr>
                <td>${resource.name}</td>
                <td>${resource.type}</td>
                <td>
                    <span class="badge ${resource.status === '运行' ? 'bg-success' : resource.status === '警告' ? 'bg-warning text-dark' : 'bg-secondary'}">${resource.status}</span>
                </td>
                <td>${resource.cost}</td>
            </tr>
        `)
        .join('');
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

    resourceLabel.textContent = `${appName} 的资源`;
    renderResourceTable(resourceTableBody, appResources[appName]);
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
        '若需部署新应用，可在应用管理页面点击“创建应用”，并选择合适的模板与参数。',
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
    bootstrapDefaultTabs();
});
