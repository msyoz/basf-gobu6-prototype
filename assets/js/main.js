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
    approved: { label: '已审批', className: 'bg-success' },
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

const APPLICATION_STATUS_BADGES = {
    pending: { label: '待审批', className: 'badge bg-info text-dark' },
    approved: { label: '已审批', className: 'badge bg-primary' },
    creating: { label: '创建中', className: 'badge bg-warning text-dark' },
    created: { label: '已创建', className: 'badge bg-success' },
    rejected: { label: '已拒绝', className: 'badge bg-danger' }
};

const TEMPLATE_VERSION_STORE = {
    'SAP S/4HANA': 6,
    'AI Pipeline': 5,
    'Lab Automation': 4
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
    const tenantAdmins = (roleAssignments['Tenant Admins']?.users || []);
    const platformAdmins = (roleAssignments['Platform Admins']?.users || []);

    const tenantAdmin = tenantAdmins.find(user => user.tenant === tenantName) || tenantAdmins[0] || {};
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
            role: '租户管理员',
            title: '2级 审批 - 租户管理员',
            contactName: tenantAdmin.name || '未配置',
            contactEmail: tenantAdmin.email || '--'
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
            approvalModalElements.confirmBtn.textContent = '已审批';
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
        approvalModalElements.confirmBtn.textContent = '已审批';
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

function syncApplicationRowActions(row) {
    if (!row) return;

    const status = row.dataset.status || 'pending';

    const approveBtn = row.querySelector('[data-action="approve-app"]');
    if (approveBtn) {
        const shouldShowApprove = status === 'pending';
        approveBtn.classList.toggle('d-none', !shouldShowApprove);
        approveBtn.disabled = !shouldShowApprove;
        approveBtn.textContent = '批准';
        approveBtn.classList.remove('btn-success', 'btn-outline-secondary');
        if (!approveBtn.classList.contains('btn-outline-success')) {
            approveBtn.classList.add('btn-outline-success');
        }
    }

    const deleteBtn = row.querySelector('[data-action="delete-app"]');
    if (deleteBtn) {
        const shouldShowDelete = status === 'created';
        deleteBtn.classList.toggle('d-none', !shouldShowDelete);
        deleteBtn.disabled = !shouldShowDelete;
    }
}

function updateApplicationRowStatus(status) {
    const row = approvalState.currentRow;
    if (!row) return;

    row.dataset.status = status;

    const statusBadge = row.querySelector('[data-role="deployment-status"]');
    if (statusBadge) {
        const variant = APPLICATION_STATUS_BADGES[status] || APPLICATION_STATUS_BADGES.pending;
        statusBadge.className = variant.className;
        statusBadge.textContent = variant.label;
    }

    syncApplicationRowActions(row);
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

function syncTemplateRegistry(scope = document) {
    if (!scope) return;
    const rows = scope.querySelectorAll('[data-template-name][data-template-version]');
    rows.forEach(row => {
        const name = row.dataset.templateName || '';
        const versionValue = Number(row.dataset.templateVersion);
        if (!name) return;
        if (!Number.isNaN(versionValue) && versionValue > 0) {
            TEMPLATE_VERSION_STORE[name] = versionValue;
        }
    });
}

function locateTemplateRow(templateName, scope = document) {
    if (!templateName) return null;
    const rows = scope.querySelectorAll('[data-template-name]');
    return Array.from(rows).find(row => row.dataset.templateName === templateName) || null;
}

function getCurrentTemplateVersion(templateName, overrideVersion) {
    if (!templateName) return 0;

    if (typeof overrideVersion === 'number' && !Number.isNaN(overrideVersion) && overrideVersion > 0) {
        return overrideVersion;
    }

    const stored = Number(TEMPLATE_VERSION_STORE[templateName]);
    if (!Number.isNaN(stored) && stored > 0) {
        return stored;
    }

    const row = locateTemplateRow(templateName);
    if (row) {
        const datasetValue = Number(row.dataset.templateVersion);
        if (!Number.isNaN(datasetValue) && datasetValue > 0) {
            TEMPLATE_VERSION_STORE[templateName] = datasetValue;
            return datasetValue;
        }

        const versionCell = row.querySelector('td:nth-child(2)');
        if (versionCell) {
            const cellValue = Number((versionCell.textContent || '').trim());
            if (!Number.isNaN(cellValue) && cellValue > 0) {
                TEMPLATE_VERSION_STORE[templateName] = cellValue;
                return cellValue;
            }
        }
    }

    return 0;
}

function setTemplateVersion(templateName, version) {
    if (!templateName) return;
    const numericVersion = Number(version);
    if (Number.isNaN(numericVersion) || numericVersion < 1) return;

    const normalized = Math.round(numericVersion);
    TEMPLATE_VERSION_STORE[templateName] = normalized;

    const row = locateTemplateRow(templateName);
    if (row) {
        row.dataset.templateVersion = String(normalized);
        const versionCell = row.querySelector('td:nth-child(2)');
        if (versionCell) {
            versionCell.textContent = String(normalized);
        }
        const triggerButton = row.querySelector('[data-template-name][data-template-version]');
        if (triggerButton) {
            triggerButton.setAttribute('data-template-version', String(normalized));
        }
    }
}

const APP_TEMPLATE_PARAMETERS = {
    'sap-s4hana': [
        {
            name: 'region',
            type: 'select',
            value: 'China North 3',
            options: ['China East 3', 'China North 3', 'China North 2']
        },
        {
            name: 'environment',
            type: 'select',
            value: 'production',
            options: ['dev', 'test', 'production']
        },
        {
            name: 'vmSize',
            type: 'select',
            value: 'Standard_D8s_v5',
            options: ['Standard_D4s_v4', 'Standard_D8s_v5', 'Standard_E4s_v5']
        },
        {
            name: 'adminEmail',
            type: 'text',
            value: 'sap-admin@rd-digital.com'
        }
    ],
    'ai-pipeline': [
        {
            name: 'region',
            type: 'select',
            value: 'China East 3',
            options: ['China East 3', 'China North 3']
        },
        {
            name: 'computeCluster',
            type: 'select',
            value: 'gpu-d16',
            options: ['cpu-d8', 'gpu-d16', 'gpu-d32']
        },
        {
            name: 'dataLakeName',
            type: 'text',
            value: 'adl-agri-insight'
        },
        {
            name: 'enableDr',
            type: 'select',
            value: 'true',
            options: ['true', 'false']
        }
    ],
    'lab-automation': [
        {
            name: 'region',
            type: 'select',
            value: 'China North 2',
            options: ['China North 2', 'China North 3']
        },
        {
            name: 'storageTier',
            type: 'select',
            value: 'hot',
            options: ['hot', 'cool']
        },
        {
            name: 'retentionDays',
            type: 'text',
            value: '30'
        },
        {
            name: 'contactGroup',
            type: 'text',
            value: 'lab-automation-ops'
        }
    ],
    'esg-landing-zone': [
        {
            name: 'region',
            type: 'select',
            value: 'China North 3',
            options: ['China North 3', 'China East 3']
        },
        {
            name: 'complianceLevel',
            type: 'select',
            value: 'cn-tier-1',
            options: ['cn-tier-1', 'cn-tier-2']
        },
        {
            name: 'enableCostGuard',
            type: 'select',
            value: 'true',
            options: ['true', 'false']
        },
        {
            name: 'ownerEmail',
            type: 'text',
            value: 'esg-owner@rd-digital.com'
        }
    ]
};

const APPLICATION_DEPLOYMENTS = {
    'APP-RG-001': {
        code: 'APP-RG-001',
        name: 'RG-default ERP',
        tenant: 'RG-default',
        templateId: 'sap-s4hana',
        templateName: 'SAP S/4HANA',
        parameters: [
            {
                name: 'region',
                type: 'select',
                value: 'China North 3',
                options: ['China East 3', 'China North 3', 'China North 2']
            },
            {
                name: 'environment',
                type: 'select',
                value: 'production',
                options: ['dev', 'test', 'production']
            },
            {
                name: 'vmSize',
                type: 'select',
                value: 'Standard_D8s_v5',
                options: ['Standard_D4s_v4', 'Standard_D8s_v5', 'Standard_E4s_v5']
            },
            {
                name: 'adminEmail',
                type: 'text',
                value: 'sap-admin@rd-digital.com'
            }
        ]
    },
    'APP-EV-014': {
        code: 'APP-EV-014',
        name: 'Agri AI Insights',
        tenant: 'EV-default',
        templateId: 'ai-pipeline',
        templateName: 'AI Pipeline',
        parameters: [
            {
                name: 'region',
                type: 'select',
                value: 'China East 3',
                options: ['China East 3', 'China North 3']
            },
            {
                name: 'computeCluster',
                type: 'select',
                value: 'gpu-d16',
                options: ['cpu-d8', 'gpu-d16', 'gpu-d32']
            },
            {
                name: 'dataLakeName',
                type: 'text',
                value: 'adl-agri-insight'
            },
            {
                name: 'enableDr',
                type: 'select',
                value: 'true',
                options: ['true', 'false']
            }
        ]
    },
    'APP-RG-019': {
        code: 'APP-RG-019',
        name: 'RG-default ESG Portal',
        tenant: 'RG-default',
        templateId: 'esg-landing-zone',
        templateName: 'ESG Landing Zone',
        parameters: [
            {
                name: 'region',
                type: 'select',
                value: 'China North 3',
                options: ['China North 3', 'China East 3']
            },
            {
                name: 'complianceLevel',
                type: 'select',
                value: 'cn-tier-1',
                options: ['cn-tier-1', 'cn-tier-2']
            },
            {
                name: 'enableCostGuard',
                type: 'select',
                value: 'true',
                options: ['true', 'false']
            },
            {
                name: 'ownerEmail',
                type: 'text',
                value: 'esg-owner@rd-digital.com'
            }
        ]
    },
    'APP-ED-008': {
        code: 'APP-ED-008',
        name: 'BioCloud LIMS',
        tenant: 'ED-default',
        templateId: 'lab-automation',
        templateName: 'Lab Automation',
        parameters: [
            {
                name: 'region',
                type: 'select',
                value: 'China North 2',
                options: ['China North 2', 'China North 3']
            },
            {
                name: 'storageTier',
                type: 'select',
                value: 'hot',
                options: ['hot', 'cool']
            },
            {
                name: 'retentionDays',
                type: 'text',
                value: '30'
            },
            {
                name: 'contactGroup',
                type: 'text',
                value: 'lab-automation-ops'
            }
        ]
    }
};

function setupParameterPanel(modalElement) {
    if (!modalElement) return null;

    const table = modalElement.querySelector('[data-role="parameter-table"]');
    const tableBody = modalElement.querySelector('[data-role="parameter-body"]');
    const emptyState = modalElement.querySelector('[data-role="parameter-empty"]');
    const hint = modalElement.querySelector('[data-role="parameter-hint"]');

    if (!tableBody) return null;

    const updateEmptyState = () => {
        const hasRows = tableBody.querySelectorAll('tr').length > 0;
        table?.classList.toggle('d-none', !hasRows);
        emptyState?.classList.toggle('d-none', hasRows);
    };

    const setHint = (message, tone = 'muted') => {
        if (!hint) return;
        hint.textContent = message;
        hint.classList.remove('text-muted', 'text-warning');
        hint.classList.add(tone === 'warning' ? 'text-warning' : 'text-muted');
    };

    const setValueControl = (row, type, value, optionsList) => {
        const cell = row.querySelector('[data-role="param-value-cell"]');
        if (!cell) return;

        const normalizedOptions = Array.isArray(optionsList) ? optionsList : [];
        const resolvedValue = value !== undefined && value !== null && value !== ''
            ? value
            : normalizedOptions[0] || '';

        cell.innerHTML = '';

        if (type === 'select') {
            const select = document.createElement('select');
            select.className = 'form-select form-select-sm';
            select.name = 'paramValue[]';
            select.dataset.role = 'param-value';

            if (normalizedOptions.length === 0) {
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = '无可选值';
                placeholder.disabled = true;
                placeholder.selected = true;
                select.appendChild(placeholder);
            } else {
                normalizedOptions.forEach(optionValue => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    select.appendChild(option);
                });

                if (normalizedOptions.includes(resolvedValue)) {
                    select.value = resolvedValue;
                } else {
                    select.value = normalizedOptions[0];
                }
            }

            cell.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control form-control-sm';
            input.name = 'paramValue[]';
            input.dataset.role = 'param-value';
            input.placeholder = '请输入参数值';
            input.value = resolvedValue;
            cell.appendChild(input);
        }
    };

    const createRow = (param = {}) => {
        const { name = '', type = 'text', value = '', options = [] } = param;
        const row = document.createElement('tr');
        row.dataset.role = 'parameter-row';

        const typeLabel = type === 'select' ? '下拉选择' : '文本输入';
        const normalizedOptions = Array.isArray(options) ? options : [];

        row.innerHTML = `
            <td>
                <span class="form-control-plaintext fw-semibold mb-0">${name}</span>
                <input type="hidden" name="paramName[]" value="${name}">
            </td>
            <td>
                <span class="badge bg-light text-dark" data-role="param-type-label">${typeLabel}</span>
                <input type="hidden" name="paramType[]" value="${type}">
            </td>
            <td data-role="param-value-cell"></td>
            <td data-role="param-options-cell"></td>
        `;

        const optionsCell = row.querySelector('[data-role="param-options-cell"]');
        if (optionsCell) {
            if (normalizedOptions.length === 0) {
                optionsCell.innerHTML = '<span class="text-muted">--</span>';
            } else {
                const list = document.createElement('div');
                list.className = 'd-flex flex-wrap gap-1';
                normalizedOptions.forEach(optionValue => {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-light text-primary border border-primary border-opacity-25';
                    badge.textContent = optionValue;
                    list.appendChild(badge);
                });
                optionsCell.appendChild(list);
            }

            const hiddenOptions = document.createElement('input');
            hiddenOptions.type = 'hidden';
            hiddenOptions.name = 'paramOptions[]';
            hiddenOptions.value = normalizedOptions.join(',');
            optionsCell.appendChild(hiddenOptions);
        }

        setValueControl(row, type, value, normalizedOptions);

        return row;
    };

    const clear = () => {
        tableBody.innerHTML = '';
        updateEmptyState();
    };

    const renderParameters = (parameters = []) => {
        clear();
        if (!Array.isArray(parameters) || parameters.length === 0) {
            updateEmptyState();
            return;
        }

        parameters.forEach(param => {
            const row = createRow(param);
            tableBody.appendChild(row);
        });

        updateEmptyState();
    };

    updateEmptyState();

    return {
        renderParameters,
        clear,
        updateEmptyState,
        setHint,
        table,
        tableBody,
        emptyState
    };
}

function setupResourcePanel(modalElement) {
    if (!modalElement) return null;

    const table = modalElement.querySelector('[data-role="resource-table"]');
    const tableBody = modalElement.querySelector('[data-role="resource-body"]');
    const emptyState = modalElement.querySelector('[data-role="resource-empty"]');
    const hint = modalElement.querySelector('[data-role="resource-hint"]');
    const addBtn = modalElement.querySelector('[data-action="add-resource-row"]');

    if (!tableBody || !addBtn) return null;

    const state = {
        tenant: '',
        app: '',
        resources: []
    };

    const normalizeToneClass = tone => {
        switch (tone) {
            case 'warning':
                return 'text-warning';
            case 'danger':
                return 'text-danger';
            case 'success':
                return 'text-success';
            default:
                return 'text-muted';
        }
    };

    const setHint = (message, tone = 'muted') => {
        if (!hint) return;
        hint.textContent = message;
        hint.classList.remove('text-muted', 'text-warning', 'text-danger', 'text-success');
        hint.classList.add(normalizeToneClass(tone));
    };

    const updateEmptyState = () => {
        const hasRows = tableBody.querySelectorAll('tr[data-index]').length > 0;
        table?.classList.toggle('d-none', !hasRows);
        emptyState?.classList.toggle('d-none', hasRows);
    };

    const captureCurrentState = () => {
        const rows = Array.from(tableBody.querySelectorAll('tr[data-index]'));
        if (!rows.length) {
            state.resources = [];
            return;
        }

        state.resources = rows.map(row => {
            const nameInput = row.querySelector('input[name="resourceName[]"]');
            const typeInput = row.querySelector('input[name="resourceType[]"]');
            const regionInput = row.querySelector('input[name="resourceRegion[]"]');
            return {
                tenant: state.tenant,
                app: state.app,
                name: nameInput?.value.trim() || '',
                type: typeInput?.value.trim() || '',
                region: regionInput?.value.trim() || '',
                status: row.dataset.status || '待创建',
                lastActivity: row.dataset.lastActivity || '--',
                cost: row.dataset.cost || '预估 --',
                mode: row.dataset.mode || 'existing'
            };
        });
    };

    const buildRow = (resource, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        row.dataset.status = resource.status || '待创建';
        row.dataset.lastActivity = resource.lastActivity || '--';
        row.dataset.cost = resource.cost || '预估 --';
        row.dataset.mode = resource.mode || 'existing';

        row.innerHTML = `
            <td>
                <input type="text" class="form-control form-control-sm" name="resourceName[]" value="${resource.name || ''}" placeholder="例如 vm-app-01">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" name="resourceType[]" value="${resource.type || ''}" placeholder="例如 虚拟机">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm" name="resourceRegion[]" value="${resource.region || ''}" placeholder="例如 China North 3">
            </td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-resource">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        return row;
    };

    const render = () => {
        tableBody.innerHTML = '';
        state.resources.forEach((resource, index) => {
            const row = buildRow(resource, index);
            tableBody.appendChild(row);
        });
        updateEmptyState();
    };

    const addResource = () => {
        captureCurrentState();
        state.resources.push({
            tenant: state.tenant,
            app: state.app,
            name: '',
            type: '',
            region: '',
            status: '待创建',
            lastActivity: '--',
            cost: '预估 --',
            mode: 'new'
        });
        render();
        const newestNameInput = tableBody.querySelector('tr:last-child input[name="resourceName[]"]');
        newestNameInput?.focus();
        setHint('新增资源请填写名称、类型与区域。', 'muted');
    };

    const removeResource = index => {
        captureCurrentState();
        if (index < 0 || index >= state.resources.length) return;
        state.resources.splice(index, 1);
        render();
        setHint('已从本次申请中移除资源。', 'muted');
    };

    const validate = () => {
        captureCurrentState();
        tableBody.querySelectorAll('input.is-invalid').forEach(input => input.classList.remove('is-invalid'));

        if (state.resources.length === 0) {
            return { valid: true, focus: null };
        }

        let firstInvalid = null;

        state.resources.forEach((resource, index) => {
            const row = tableBody.querySelector(`tr[data-index="${index}"]`);
            if (!row) return;

            const ensureField = (value, selector) => {
                if (value) return;
                const input = row.querySelector(selector);
                if (input) {
                    input.classList.add('is-invalid');
                    if (!firstInvalid) {
                        firstInvalid = input;
                    }
                }
            };

            ensureField(resource.name, 'input[name="resourceName[]"]');
            ensureField(resource.type, 'input[name="resourceType[]"]');
        });

        return {
            valid: !firstInvalid,
            focus: firstInvalid
        };
    };

    const getResources = () => {
        captureCurrentState();
        return state.resources.map(resource => ({
            tenant: resource.tenant || state.tenant,
            app: resource.app || state.app,
            name: resource.name,
            type: resource.type,
            region: resource.region,
            status: resource.status || '待创建',
            lastActivity: resource.lastActivity || '--',
            cost: resource.cost || '预估 --'
        }));
    };

    const clear = () => {
        state.tenant = '';
        state.app = '';
        state.resources = [];
        render();
        addBtn.disabled = true;
        setHint('请选择应用以查看资源。', 'muted');
    };

    const setContext = ({ resources = [], tenant = '', app = '' } = {}) => {
        state.tenant = tenant;
        state.app = app;
        state.resources = resources.map(resource => ({
            tenant: resource.tenant || tenant,
            app: resource.app || app,
            name: resource.name || '',
            type: resource.type || '',
            region: resource.region || '',
            status: resource.status || '待创建',
            lastActivity: resource.lastActivity || '--',
            cost: resource.cost || '预估 --',
            mode: 'existing'
        }));

        addBtn.disabled = !app;
        render();

        if (!app) {
            setHint('请选择应用以查看资源。', 'muted');
        } else if (state.resources.length === 0) {
            setHint('该应用当前未登记资源，可添加新的资源项。', 'muted');
        } else {
            setHint('可以更新资源信息，或添加/删除资源。', 'muted');
        }
    };

    addBtn.addEventListener('click', () => {
        if (!state.app) {
            setHint('请选择应用后再添加资源。', 'warning');
            return;
        }
        addResource();
    });

    tableBody.addEventListener('click', event => {
        const removeBtn = event.target.closest('[data-action="remove-resource"]');
        if (!removeBtn) return;
        const row = removeBtn.closest('tr');
        const index = Number(row?.dataset.index);
        if (!Number.isNaN(index)) {
            removeResource(index);
        }
    });

    tableBody.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (input.classList.contains('is-invalid')) {
            input.classList.remove('is-invalid');
        }
    });

    clear();

    return {
        setContext,
        clear,
        getResources,
        validate,
        setHint,
        updateEmptyState
    };
}

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
    'Tenant App Requesters': {
        description: '租户应用申请者，可以为所在租户申请新应用',
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

const tenantUserRoles = ['租户应用申请者', '租户使用者'];
const tenantUsersDirectory = {
    'RG-default': [
        { name: 'Chen Yu', email: 'chenyu@RG-default.cn', role: '租户应用申请者' },
        { name: 'Sun Tao', email: 'suntao@RG-default.cn', role: '租户使用者' }
    ],
    'EV-default': [
        { name: 'Gao Ling', email: 'gaoling@EV-default.cn', role: '租户应用申请者' },
        { name: 'Ma Rui', email: 'marui@EV-default.cn', role: '租户使用者' }
    ],
    'ED-default': [
        { name: 'Luo Bin', email: 'luobin@biocloud.cn', role: '租户应用申请者' },
        { name: 'He Na', email: 'hena@biocloud.cn', role: '租户使用者' }
    ]
};

const tenantUserGroups = {
    'RG-default 应用团队': [
        { name: 'Zhao Lei', email: 'zhaolei@RG-default.cn' },
        { name: 'Qin Wei', email: 'qinwei@RG-default.cn' }
    ],
    'EV-default 数据组': [
        { name: 'Xu Lin', email: 'xulin@EV-default.cn' },
        { name: 'Wu Fan', email: 'wufan@EV-default.cn' }
    ],
    'ED-default 实验组': [
        { name: 'Han Mei', email: 'hanmei@biocloud.cn' },
        { name: 'Tang Fei', email: 'tangfei@biocloud.cn' }
    ]
};

const appTenantMap = {
    'RG-default ERP': 'RG-default',
    'Agri AI Insights': 'EV-default',
    'RG-default ESG Portal': 'RG-default',
    'BioCloud LIMS': 'ED-default'
};

const tenantApplications = Object.entries(appTenantMap).reduce((acc, [app, tenant]) => {
    if (!acc[tenant]) {
        acc[tenant] = [];
    }
    acc[tenant].push(app);
    return acc;
}, {});

const resourceInventory = [
    {
        tenant: 'RG-default',
        app: 'RG-default ERP',
        name: 'vm-erp-prod-01',
        type: '虚拟机',
        region: 'China North 3',
        status: '运行',
        lastActivity: '12 分钟前',
        cost: '¥ 3,120'
    },
    {
        tenant: 'RG-default',
        app: 'RG-default ERP',
        name: 'db-erp-prod-02',
        type: '数据库',
        region: 'China North 3',
        status: '运行',
        lastActivity: '18 分钟前',
        cost: '¥ 5,680'
    },
    {
        tenant: 'RG-default',
        app: 'RG-default ESG Portal',
        name: 'aks-esg-cluster',
        type: '容器服务',
        region: 'China North 3',
        status: '待创建',
        lastActivity: '--',
        cost: '预估 ¥ 9,500'
    },
    {
        tenant: 'RG-default',
        app: 'RG-default ESG Portal',
        name: 'db-esg-analytics',
        type: '数据库',
        region: 'China North 3',
        status: '待创建',
        lastActivity: '--',
        cost: '预估 ¥ 6,800'
    },
    {
        tenant: 'EV-default',
        app: 'Agri AI Insights',
        name: 'aks-ai-cluster',
        type: '容器服务',
        region: 'China East 2',
        status: '部署中',
        lastActivity: '5 分钟前',
        cost: '¥ 7,410'
    },
    {
        tenant: 'EV-default',
        app: 'Agri AI Insights',
        name: 'ds-ai-data-lake',
        type: 'Data Lake',
        region: 'China East 2',
        status: '警告',
        lastActivity: '45 分钟前',
        cost: '¥ 4,560'
    },
    {
        tenant: 'ED-default',
        app: 'BioCloud LIMS',
        name: 'sql-lims-prod',
        type: '数据库',
        region: 'China East 3',
        status: '运行',
        lastActivity: '9 分钟前',
        cost: '¥ 6,340'
    },
    {
        tenant: 'ED-default',
        app: 'BioCloud LIMS',
        name: 'func-lims-automation',
        type: '函数应用',
        region: 'China East 3',
        status: '运行',
        lastActivity: '6 分钟前',
        cost: '¥ 1,240'
    }
];

const resourceActivityLogs = {
    'vm-erp-prod-01': [
        { eventName: '补丁更新完成', status: 'Succeeded', date: '2025-10-10 21:12' },
        { eventName: '安全基线扫描完成', status: 'Succeeded', date: '2025-10-09 08:30' }
    ],
    'db-erp-prod-02': [
        { eventName: '存储扩容至 512GB', status: 'Succeeded', date: '2025-10-09 10:04' },
        { eventName: '性能监控基线执行', status: 'Succeeded', date: '2025-10-07 19:20' }
    ],
    'aks-esg-cluster': [
        { eventName: '部署审批通过', status: 'Succeeded', date: '2025-10-11 09:12' },
        { eventName: '集群部署任务排队', status: 'InProgress', date: '2025-10-11 09:15' }
    ],
    'db-esg-analytics': [
        { eventName: '等待 Terraform Plan 确认', status: 'Pending', date: '2025-10-10 18:44' }
    ],
    'aks-ai-cluster': [
        { eventName: '节点池扩容至 6 台', status: 'Succeeded', date: '2025-10-11 08:22' },
        { eventName: '集群部署', status: 'InProgress', date: '2025-10-11 08:35' }
    ],
    'ds-ai-data-lake': [
        { eventName: '读写延迟告警', status: 'Failed', date: '2025-10-10 23:02' },
        { eventName: '恢复热存储', status: 'Succeeded', date: '2025-10-11 00:18' }
    ],
    'sql-lims-prod': [
        { eventName: '自动备份执行', status: 'Succeeded', date: '2025-10-11 02:00' },
        { eventName: '索引优化计划', status: 'Succeeded', date: '2025-10-10 20:46' }
    ],
    'func-lims-automation': [
        { eventName: '发布新版本 v1.4.2', status: 'Succeeded', date: '2025-10-10 15:48' },
        { eventName: '批量执行监控', status: 'Succeeded', date: '2025-10-10 22:10' }
    ]
};

const KNOWLEDGE_PAGE_SIZE = 5;

const KNOWLEDGE_PARSE_STATUS_VARIANTS = {
    success: { label: '解析成功', className: 'bg-success' },
    processing: { label: '解析中', className: 'bg-info text-dark' },
    pending: { label: '等待解析', className: 'bg-secondary' },
    failed: { label: '解析失败', className: 'bg-danger' }
};

const KNOWLEDGE_DOCUMENTS = {
    tenant: [
        { id: 'tenant-001', name: '平台快速入门指南', uploadedAt: '2025-09-21', enabled: true, parseState: 'success' },
        { id: 'tenant-002', name: '租户管理最佳实践', uploadedAt: '2025-07-12', enabled: true, parseState: 'success' },
        { id: 'tenant-003', name: 'Terraform 模板开发规范', uploadedAt: '2025-10-01', enabled: false, parseState: 'processing' },
        { id: 'tenant-004', name: '安全基线合规手册', uploadedAt: '2025-08-30', enabled: true, parseState: 'pending' },
        { id: 'tenant-005', name: '成本优化白皮书', uploadedAt: '2025-06-18', enabled: true, parseState: 'success' },
        { id: 'tenant-006', name: 'DevOps 集成指引', uploadedAt: '2025-05-04', enabled: false, parseState: 'failed' }
    ],
    personal: [
        { id: 'personal-001', name: '个人操作手册', uploadedAt: '2025-09-05', enabled: true, parseState: 'success' },
        { id: 'personal-002', name: '常见问题笔记', uploadedAt: '2025-08-11', enabled: true, parseState: 'processing' },
        { id: 'personal-003', name: '数据模型草稿', uploadedAt: '2025-07-22', enabled: false, parseState: 'pending' },
        { id: 'personal-004', name: '脚本片段整理', uploadedAt: '2025-04-09', enabled: true, parseState: 'failed' }
    ]
};

const KNOWLEDGE_QA_RESPONSE_DELAY = 600;

const KNOWLEDGE_QA_SCOPE_CONFIG = {
    tenant: {
        title: '租户知识库问答',
        description: '从租户知识库检索最佳答案',
        context: '当前租户：RG-default',
        welcome: '您好，我可以针对租户知识库内容为您解答。请告诉我您的问题。'
    },
    personal: {
        title: '个人知识库问答',
        description: '结合个人笔记提供专属建议',
        context: '当前用户：Admin User',
        welcome: '这里是您的个人知识助手，尽管提出问题，我会根据个人资料进行回答。'
    }
};

const KNOWLEDGE_QA_PRESET_RESPONSES = {
    tenant: [
        {
            answer: '根据租户知识库，应用上线流程分为申请、审批与部署三个阶段，您可以在应用管理页面跟踪每一步状态。'
        },
        {
            answer: '租户常见问题手册建议：在提交 Terraform 模板更新前，先在沙箱租户验证参数，并同步管理员审批人名单。'
        },
        {
            answer: '成本优化章节指出：建议每月复核云资源使用情况，对闲置的计算实例设置自动关停策略。'
        }
    ],
    personal: [
        {
            answer: '您在个人笔记中记录：处理平台工单时，优先检查租户访问策略是否包含最新的用户组配置。'
        },
        {
            answer: '根据您的常见问题整理，部署脚本失败时可先执行 “az login --tenant <tenantId>” 重新授权后重试。'
        },
        {
            answer: '个人知识库提示：每次发布前，请更新变更记录并通知项目干系人确认。'
        }
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
        if (page === 'applications' && (payload.tenant || payload.app)) {
            setTimeout(() => selectTenantInApplications(payload.tenant || '', payload.app || ''), 150);
        } else if (page === 'resources' && (payload.tenant || payload.app)) {
            setTimeout(() => applyResourceFilters(payload.tenant || '', payload.app || ''), 150);
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
    } else if (page === 'resources') {
        initializeResourcesTab(tabPane, payload);
    } else if (page === 'knowledge') {
        initializeKnowledgeTab(tabPane);
    } else if (page === 'knowledge-qa') {
        initializeKnowledgeQATab(tabPane);
    } else if (page === 'templates') {
        initializeTemplatesTab(tabPane);
    }
}

function initializeApplicationsTab(container, payload = {}) {
    initializeApprovalModal();

    const tenantSelector = container.querySelector(`#${applicationTenantSelectorTemplateId}`);
    const appRows = container.querySelectorAll('#applicationsTable tbody tr');

    if (tenantSelector) {
        tenantSelector.addEventListener('change', () => {
            filterApplicationsTable(container, tenantSelector.value);
        });
    }

    function initializeTemplatesTab(container) {
        syncTemplateRegistry(container);
    }

    appRows.forEach(row => {
        const approveBtn = row.querySelector('[data-action="approve-app"]');
        if (approveBtn) {
            approveBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                openApprovalModal(row);
            });
        }

        syncApplicationRowActions(row);
    });

    const initialTenant = payload.tenant || tenantSelector?.value || '';
    if (tenantSelector && payload.tenant) {
        tenantSelector.value = payload.tenant;
    }

    filterApplicationsTable(container, initialTenant);

    if (payload.app) {
        const targetRow = container.querySelector(`#applicationsTable tbody tr[data-app="${payload.app}"]`);
        if (targetRow) {
            targetRow.classList.add('table-active');
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => targetRow.classList.remove('table-active'), 1500);
        }
    }
}

function selectTenantInApplications(tenant, app) {
    const tabPane = document.getElementById(createTabId('applications'));
    if (!tabPane) return;

    const tenantSelector = tabPane.querySelector(`#${applicationTenantSelectorTemplateId}`);
    if (tenantSelector) {
        tenantSelector.value = tenant || '';
    }

    filterApplicationsTable(tabPane, tenant || '');

    if (app) {
        const targetRow = tabPane.querySelector(`#applicationsTable tbody tr[data-app="${app}"]`);
        if (targetRow) {
            targetRow.classList.add('table-active');
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => targetRow.classList.remove('table-active'), 1500);
        }
    }
}

function filterApplicationsTable(container, tenant) {
    const tbody = container.querySelector('#applicationsTable tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.dataset.role !== 'applications-placeholder');
    let visibleCount = 0;

    rows.forEach(row => {
        const matches = !tenant || row.dataset.tenant === tenant;
        row.classList.toggle('d-none', !matches);
        if (matches) {
            visibleCount += 1;
        }
    });

    let placeholderRow = tbody.querySelector('[data-role="applications-placeholder"]');
    if (visibleCount === 0) {
        if (!placeholderRow) {
            placeholderRow = document.createElement('tr');
            placeholderRow.dataset.role = 'applications-placeholder';
            placeholderRow.className = 'placeholder-row';
            placeholderRow.innerHTML = '<td colspan="6" class="text-center text-muted"></td>';
            tbody.appendChild(placeholderRow);
        }
        const cell = placeholderRow.querySelector('td');
        if (cell) {
            cell.textContent = tenant ? '所选租户暂无应用。' : '暂无应用数据。';
        }
    } else if (placeholderRow) {
        placeholderRow.remove();
    }
}

function initializeResourcesTab(container, payload = {}) {
    const tenantSelect = container.querySelector('#resourceTenantSelector');
    const appSelect = container.querySelector('#resourceAppSelector');
    const tableBody = container.querySelector('#resourceListTable tbody');
    const exportBtn = container.querySelector('[data-action="export-resources"]');
    const activityList = container.querySelector('[data-role="activity-list"]');
    const activityTarget = container.querySelector('[data-role="activity-target"]');
    const activityRefreshBtn = container.querySelector('[data-action="refresh-activity"]');

    if (!tenantSelect || !appSelect || !tableBody || !activityList || !activityTarget) return;

    const tenants = Object.keys(tenantApplications);
    const tenantOptions = ['<option value="">请选择租户...</option>'].concat(
        tenants.map(tenant => `<option value="${tenant}">${tenant}</option>`)
    );
    tenantSelect.innerHTML = tenantOptions.join('');
    appSelect.innerHTML = '<option value="">全部应用</option>';
    appSelect.disabled = true;

    const controls = {
        tenantSelect,
        appSelect,
        tableBody,
        exportBtn,
        activityList,
        activityTarget,
        activityRefreshBtn,
        selectedResource: '',
        resetActivityPanel() {
            if (this.activityTarget) {
                this.activityTarget.textContent = '请选择资源';
            }
            if (this.activityList) {
                this.activityList.innerHTML = '<div class="list-group-item text-muted">请选择资源查看活动日志。</div>';
            }
            if (this.activityRefreshBtn) {
                this.activityRefreshBtn.disabled = true;
            }
            this.selectedResource = '';
        },
        renderActivity(resourceName) {
            if (!resourceName || !this.activityList || !this.activityTarget) {
                this.resetActivityPanel();
                return;
            }

            const logs = resourceActivityLogs[resourceName] || [];
            if (!logs.length) {
                this.activityList.innerHTML = '<div class="list-group-item text-muted">该资源暂无活动日志。</div>';
            } else {
                const statusBadgeMap = {
                    Succeeded: 'bg-success',
                    Failed: 'bg-danger',
                    InProgress: 'bg-warning text-dark',
                    Pending: 'bg-secondary'
                };
                this.activityList.innerHTML = logs
                    .map(log => {
                        const badgeClass = statusBadgeMap[log.status] || 'bg-secondary';
                        return `
                        <div class="list-group-item d-flex justify-content-between align-items-start">
                            <div>
                                <div class="fw-semibold">${log.eventName}</div>
                                <small class="text-muted">${log.date}</small>
                            </div>
                            <span class="badge ${badgeClass}">${log.status}</span>
                        </div>
                        `;
                    })
                    .join('');
            }

            this.activityTarget.textContent = `资源：${resourceName}`;
            if (this.activityRefreshBtn) {
                this.activityRefreshBtn.disabled = false;
            }
        },
        updateAppOptions(selectedTenant, preferredApp = '') {
            if (!selectedTenant) {
                appSelect.innerHTML = '<option value="">全部应用</option>';
                appSelect.value = '';
                appSelect.disabled = true;
                return '';
            }

            const apps = (tenantApplications[selectedTenant] || []).slice();
            const options = ['<option value="">全部应用</option>'].concat(
                apps.map(app => `<option value="${app}">${app}</option>`)
            );
            appSelect.innerHTML = options.join('');

            const resolved = preferredApp && apps.includes(preferredApp) ? preferredApp : '';
            appSelect.value = resolved;
            appSelect.disabled = false;
            return resolved;
        },
        render(selectedTenant, selectedApp) {
            if (!selectedTenant) {
                renderResourceInventory(tableBody, [], '请选择租户以加载资源。');
                if (exportBtn) {
                    exportBtn.disabled = true;
                }
                this.resetActivityPanel();
                return;
            }

            const resources = getResourcesByFilter(selectedTenant, selectedApp);
            const emptyMessage = selectedApp ? '所选应用暂无资源数据。' : '该租户暂无资源数据。';
            const hasSelection = resources.some(resource => resource.name === this.selectedResource);
            if (!hasSelection) {
                this.selectedResource = '';
            }

            renderResourceInventory(tableBody, resources, emptyMessage, {
                selectedResource: this.selectedResource,
                onSelect: resource => {
                    this.selectedResource = resource?.name || '';
                    if (this.selectedResource) {
                        this.renderActivity(this.selectedResource);
                    }
                }
            });
            if (exportBtn) {
                exportBtn.disabled = !resources.length;
            }

            if (this.selectedResource) {
                this.renderActivity(this.selectedResource);
            } else {
                this.resetActivityPanel();
            }
        }
    };

    controls.resetActivityPanel();

    if (activityRefreshBtn) {
        activityRefreshBtn.addEventListener('click', () => {
            if (controls.selectedResource) {
                controls.renderActivity(controls.selectedResource);
            }
        });
        }

    tenantSelect.addEventListener('change', () => {
        const selectedTenant = tenantSelect.value;
        controls.updateAppOptions(selectedTenant);
        controls.render(selectedTenant, '');
    });

    appSelect.addEventListener('change', () => {
        controls.render(tenantSelect.value, appSelect.value);
    });

    container._resourceControls = controls;
    controls.render('', '');

    if (payload.tenant) {
        tenantSelect.value = payload.tenant;
        const selectedApp = controls.updateAppOptions(payload.tenant, payload.app || '');
        controls.render(payload.tenant, selectedApp);
    }
}

function applyResourceFilters(tenant, app) {
    const tabPane = document.getElementById(createTabId('resources'));
    const controls = tabPane?._resourceControls;
    if (!tabPane || !controls) return;

    const resolvedTenant = tenant || '';
    if (controls.tenantSelect) {
        controls.tenantSelect.value = resolvedTenant;
    }

    const resolvedApp = controls.updateAppOptions(resolvedTenant, app || '');
    controls.render(resolvedTenant, resolvedTenant ? resolvedApp : '');
}

function getResourcesByFilter(tenant, app) {
    if (!tenant) return [];
    return resourceInventory.filter(resource => {
        if (resource.tenant !== tenant) {
            return false;
        }
        if (app) {
            return resource.app === app;
        }
        return true;
    });
}

function updateResourceInventoryForApp(appName, tenant, resources = []) {
    if (!appName) return;

    const previousNames = resourceInventory
        .filter(resource => resource.app === appName)
        .map(resource => resource.name);

    for (let idx = resourceInventory.length - 1; idx >= 0; idx -= 1) {
        if (resourceInventory[idx].app === appName) {
            resourceInventory.splice(idx, 1);
        }
    }

    const normalizedResources = (Array.isArray(resources) ? resources : []).map(resource => ({
        tenant: resource.tenant || tenant,
        app: resource.app || appName,
        name: resource.name,
        type: resource.type,
        region: resource.region || '',
        status: resource.status || '待创建',
        lastActivity: resource.lastActivity || '--',
        cost: resource.cost || '预估 --'
    })).filter(resource => resource.name && resource.type);

    normalizedResources.forEach(resource => {
        resourceInventory.push(resource);
    });

    const updatedNames = normalizedResources.map(resource => resource.name);
    const removedNames = previousNames.filter(name => !updatedNames.includes(name));

    removedNames.forEach(name => {
        if (resourceActivityLogs[name]) {
            delete resourceActivityLogs[name];
        }
    });

    normalizedResources.forEach(resource => {
        if (!resourceActivityLogs[resource.name]) {
            resourceActivityLogs[resource.name] = [];
        }
    });
}

function renderResourceInventory(tbody, resources = [], emptyMessage = '暂无资源数据。', options = {}) {
    if (!tbody) return;

    if (!resources.length) {
        tbody.innerHTML = `<tr class="placeholder-row"><td colspan="6" class="text-center text-muted">${emptyMessage}</td></tr>`;
        return;
    }

    const statusClassMap = {
        '运行': 'bg-success',
        '警告': 'bg-warning text-dark',
        '待创建': 'bg-info text-dark',
        '部署中': 'bg-warning text-dark',
        '停止': 'bg-secondary'
    };

    const { onSelect, selectedResource } = options;

    const rows = resources
        .map((resource, index) => {
            const badgeClass = statusClassMap[resource.status] || 'bg-secondary';
            const isSelected = selectedResource && selectedResource === resource.name;
            return `
            <tr data-resource-index="${index}" data-resource-name="${resource.name}" class="${isSelected ? 'table-active' : ''}">
                <td>${resource.name}</td>
                <td>${resource.app}</td>
                <td>${resource.type}</td>
                <td>${resource.region || '--'}</td>
                <td><span class="badge ${badgeClass}">${resource.status}</span></td>
                <td>${resource.lastActivity || '--'}</td>
            </tr>
        `;
        })
        .join('');

    tbody.innerHTML = rows;

    if (typeof onSelect === 'function') {
        const rowsEls = tbody.querySelectorAll('tr[data-resource-index]');
        rowsEls.forEach(row => {
            row.addEventListener('click', () => {
                rowsEls.forEach(other => other.classList.remove('table-active'));
                row.classList.add('table-active');
                const idx = Number(row.dataset.resourceIndex);
                onSelect(resources[idx]);
            });
        });
    }
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

function buildKnowledgeEnabledBadge(enabled) {
    const isEnabled = Boolean(enabled);
    const label = isEnabled ? '启用' : '停用';
    const variant = isEnabled ? 'bg-success' : 'bg-secondary';
    return `<span class="badge ${variant}">${label}</span>`;
}

function buildKnowledgeParseBadge(state) {
    const variant = KNOWLEDGE_PARSE_STATUS_VARIANTS[state] || KNOWLEDGE_PARSE_STATUS_VARIANTS.pending;
    return `<span class="badge ${variant.className}">${variant.label}</span>`;
}

function renderKnowledgeRows(tbody, documents, totalCount) {
    if (!tbody) return;

    if (!totalCount) {
        tbody.innerHTML = '<tr class="placeholder-row"><td colspan="5" class="text-center text-muted">当前视图暂无文档</td></tr>';
        return;
    }

    if (!documents || documents.length === 0) {
        tbody.innerHTML = '<tr class="placeholder-row"><td colspan="5" class="text-center text-muted">当前页暂无文档</td></tr>';
        return;
    }

    tbody.innerHTML = documents
        .map(doc => `
            <tr data-document-id="${doc.id}">
                <td>${doc.name || '--'}</td>
                <td>${doc.uploadedAt || '--'}</td>
                <td>${buildKnowledgeEnabledBadge(doc.enabled)}</td>
                <td>${buildKnowledgeParseBadge(doc.parseState)}</td>
                <td class="text-end">
                    <button type="button" class="btn btn-sm ${doc.enabled ? 'btn-outline-secondary' : 'btn-outline-success'}" data-action="toggle-knowledge-enabled">
                        ${doc.enabled ? '禁用' : '启用'}
                    </button>
                </td>
            </tr>
        `)
        .join('');
}

function renderKnowledgePagination(listElement, containerElement, totalItems, currentPage) {
    if (!listElement) return;

    const totalPages = Math.ceil(totalItems / KNOWLEDGE_PAGE_SIZE);

    if (totalPages <= 1) {
        listElement.innerHTML = '';
        if (containerElement) containerElement.classList.add('d-none');
        return;
    }

    if (containerElement) containerElement.classList.remove('d-none');
    listElement.innerHTML = '';

    const createPageItem = (label, value, { disabled = false, active = false } = {}) => {
        const item = document.createElement('li');
        item.className = 'page-item';
        if (disabled) item.classList.add('disabled');
        if (active) item.classList.add('active');

        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.dataset.page = value;
        link.textContent = label;

        item.appendChild(link);
        return item;
    };

    listElement.appendChild(createPageItem('上一页', 'prev', { disabled: currentPage === 1 }));

    for (let page = 1; page <= totalPages; page += 1) {
        listElement.appendChild(createPageItem(String(page), String(page), { active: page === currentPage }));
    }

    listElement.appendChild(createPageItem('下一页', 'next', { disabled: currentPage === totalPages }));
}

function initializeKnowledgeTab(container) {
    const scopeToggle = container.querySelector('[data-role="knowledge-scope-toggle"]');
    const scopeButtons = scopeToggle ? Array.from(scopeToggle.querySelectorAll('[data-scope]')) : [];
    const tableBody = container.querySelector('[data-role="knowledge-table-body"]');
    const paginationList = container.querySelector('[data-role="knowledge-pagination"]');
    const paginationContainer = container.querySelector('[data-role="knowledge-pagination-container"]');

    if (!tableBody || !paginationList) return;

    let currentScope = scopeButtons.find(button => button.classList.contains('btn-primary') || button.classList.contains('active'))?.dataset.scope || 'tenant';
    let currentPage = 1;

    const getDocumentsByScope = scope => {
        const documents = KNOWLEDGE_DOCUMENTS[scope];
        return Array.isArray(documents) ? documents : [];
    };

    const syncScopeButtons = () => {
        scopeButtons.forEach(button => {
            const isActive = button.dataset.scope === currentScope;
            button.classList.toggle('btn-primary', isActive);
            button.classList.toggle('btn-outline-primary', !isActive);
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const render = () => {
        const documents = getDocumentsByScope(currentScope);
        const total = documents.length;
        const totalPages = Math.max(1, Math.ceil(total / KNOWLEDGE_PAGE_SIZE));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const startIndex = (currentPage - 1) * KNOWLEDGE_PAGE_SIZE;
        const pageItems = documents.slice(startIndex, startIndex + KNOWLEDGE_PAGE_SIZE);

        renderKnowledgeRows(tableBody, pageItems, total);
        renderKnowledgePagination(paginationList, paginationContainer, total, currentPage);
    };

    tableBody.addEventListener('click', event => {
        const control = event.target.closest('[data-action="toggle-knowledge-enabled"]');
        if (!control) return;
        event.preventDefault();

        const row = control.closest('tr[data-document-id]');
        const documentId = row?.dataset.documentId;
        if (!documentId) return;

        const documents = getDocumentsByScope(currentScope);
        const target = documents.find(item => item.id === documentId);
        if (!target) return;

        target.enabled = !target.enabled;
        render();
    });

    scopeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const scope = button.dataset.scope;
            if (!scope || scope === currentScope) return;
            currentScope = scope;
            currentPage = 1;
            syncScopeButtons();
            render();
        });
    });

    paginationList.addEventListener('click', event => {
        const control = event.target.closest('[data-page]');
        if (!control) return;
        event.preventDefault();

        const parentItem = control.parentElement;
        if (parentItem?.classList.contains('disabled') || parentItem?.classList.contains('active')) return;

        const documents = getDocumentsByScope(currentScope);
        const totalPages = Math.max(1, Math.ceil(documents.length / KNOWLEDGE_PAGE_SIZE));
        const value = control.dataset.page;

        if (value === 'prev') {
            currentPage = Math.max(1, currentPage - 1);
        } else if (value === 'next') {
            currentPage = Math.min(totalPages, currentPage + 1);
        } else {
            const pageNumber = Number(value);
            if (!Number.isInteger(pageNumber)) return;
            currentPage = Math.min(totalPages, Math.max(1, pageNumber));
        }

        render();
    });

    syncScopeButtons();
    render();
}

function initializeKnowledgeQATab(container) {
    const scopeToggle = container.querySelector('[data-role="knowledge-qa-scope"]');
    const scopeButtons = scopeToggle ? Array.from(scopeToggle.querySelectorAll('[data-scope]')) : [];
    const messages = container.querySelector('[data-role="knowledge-qa-messages"]');
    const form = container.querySelector('[data-role="knowledge-qa-form"]');
    const input = container.querySelector('[data-role="knowledge-qa-input"]');
    const resetBtn = container.querySelector('[data-role="knowledge-qa-reset"]');
    const scopeLabel = container.querySelector('[data-role="knowledge-qa-scope-label"]');
    const scopeDesc = container.querySelector('[data-role="knowledge-qa-scope-desc"]');
    const scopeContext = container.querySelector('[data-role="knowledge-qa-context"]');

    if (!messages || !form || !input) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const initialScope = scopeButtons.find(button => button.classList.contains('btn-primary') || button.classList.contains('active'))?.dataset.scope || 'tenant';
    const state = {
        scope: initialScope,
        pending: false,
        counters: { tenant: 0, personal: 0 }
    };

    const syncScopeButtons = () => {
        scopeButtons.forEach(button => {
            const isActive = button.dataset.scope === state.scope;
            button.classList.toggle('btn-primary', isActive);
            button.classList.toggle('btn-outline-primary', !isActive);
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const syncScopeMeta = () => {
        const config = KNOWLEDGE_QA_SCOPE_CONFIG[state.scope];
        if (scopeLabel && config?.title) {
            scopeLabel.textContent = config.title;
        }
        if (scopeDesc) {
            scopeDesc.textContent = config?.description || '';
        }
        if (scopeContext) {
            scopeContext.textContent = config?.context || '';
        }
    };

    const createMessageElement = (role, text) => {
        const wrapper = document.createElement('div');
        wrapper.className = `knowledge-qa-message ${role}`;

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = role === 'user' ? '我' : '知识助手';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = text;

        wrapper.appendChild(name);
        wrapper.appendChild(bubble);
        return wrapper;
    };

    const appendMessage = (role, text) => {
        messages.appendChild(createMessageElement(role, text));
        messages.scrollTop = messages.scrollHeight;
    };

    const clearConversation = () => {
        messages.innerHTML = '';
    };

    const showWelcome = () => {
        const config = KNOWLEDGE_QA_SCOPE_CONFIG[state.scope];
        if (config?.welcome) {
            appendMessage('bot', config.welcome);
        }
    };

    const setPending = flag => {
        state.pending = Boolean(flag);
        input.disabled = state.pending;
        if (submitBtn) {
            submitBtn.disabled = state.pending;
            submitBtn.textContent = state.pending ? '生成中...' : '发送';
        }
    };

    const respond = () => {
        const pool = KNOWLEDGE_QA_PRESET_RESPONSES[state.scope] || [];
        const key = state.scope;
        let selected = null;

        if (pool.length > 0) {
            selected = pool[state.counters[key] % pool.length];
            state.counters[key] += 1;
        }

        setPending(true);
        setTimeout(() => {
            const reply = selected?.answer || '暂未检索到相关内容，请稍后重试或联系平台管理员。';
            appendMessage('bot', reply);
            setPending(false);
        }, KNOWLEDGE_QA_RESPONSE_DELAY);
    };

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (state.pending) return;

        const question = input.value.trim();
        if (!question) {
            input.focus();
            return;
        }

        appendMessage('user', question);
        input.value = '';
        input.focus();
        respond();
    });

    resetBtn?.addEventListener('click', () => {
        state.counters[state.scope] = 0;
        clearConversation();
        setPending(false);
        showWelcome();
    });

    scopeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const scope = button.dataset.scope;
            if (!scope || scope === state.scope) return;
            state.scope = scope;
            state.counters[scope] = 0;
            syncScopeButtons();
            syncScopeMeta();
            clearConversation();
            setPending(false);
            showWelcome();
        });
    });

    syncScopeButtons();
    syncScopeMeta();
    clearConversation();
    setPending(false);
    showWelcome();
}

function initializeRolesTab(container) {
    const roleList = container.querySelector('#roleList');
    const roleTitle = container.querySelector('#roleUserTitle');
    const roleDescription = container.querySelector('#roleDescription');
    const userTableBody = container.querySelector('#roleUsersTable tbody');
    const addUserBtn = container.querySelector('#roleAddUserBtn');

    const addableRoles = new Set(['Platform Admins', 'Tenant Admins', 'Template Admins']);
    let activeRoleName = null;

    const syncAddUserButton = () => {
        if (!addUserBtn) return;
        const shouldShow = activeRoleName && addableRoles.has(activeRoleName);
        addUserBtn.classList.toggle('d-none', !shouldShow);
        if (shouldShow) {
            addUserBtn.disabled = false;
        }
    };

    if (!roleList || !roleTitle || !roleDescription || !userTableBody) return;

    roleList.innerHTML = '';
    const roles = Object.entries(roleAssignments);

    if (roles.length === 0) {
        roleList.innerHTML = '<div class="list-group-item">暂无系统角色</div>';
        renderRoleUsers(userTableBody, []);
        roleTitle.textContent = '无可用角色';
        roleDescription.textContent = '系统尚未配置内置角色。';
        syncAddUserButton();
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
            activeRoleName = roleName;
        }
        roleList.appendChild(button);
    });

    syncAddUserButton();

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
        activeRoleName = roleName;
        syncAddUserButton();
    });

    addUserBtn?.addEventListener('click', () => {
        if (!activeRoleName) return;
        const roleInfo = roleAssignments[activeRoleName];
        if (!roleInfo) return;

        const emailInput = window.prompt('请输入要添加的用户邮箱：');
        const email = emailInput ? emailInput.trim() : '';
        if (!email) return;

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            window.alert('请输入有效的邮箱地址。');
            return;
        }

        const isDuplicated = roleInfo.users.some(user => user.email.toLowerCase() === email.toLowerCase());
        if (isDuplicated) {
            window.alert('该邮箱已在当前角色中。');
            return;
        }

        const buildNameFromEmail = value => {
            const local = value.split('@')[0] || '用户';
            const normalized = local
                .split(/[._-]+/)
                .filter(Boolean)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1));
            return normalized.length > 0 ? normalized.join(' ') : local;
        };

        let tenantValue = '--';
        if (activeRoleName === 'Platform Admins' || activeRoleName === 'Template Admins') {
            tenantValue = 'Platform';
        } else if (activeRoleName === 'Tenant Admins') {
            const tenantPrompt = window.prompt('请输入用户所属租户（可选）', '');
            tenantValue = tenantPrompt ? tenantPrompt.trim() || '--' : '--';
        }

        roleInfo.users.push({
            name: buildNameFromEmail(email),
            email,
            tenant: tenantValue
        });

        renderRoleUsers(userTableBody, roleInfo.users);

        const badge = roleList.querySelector(`[data-role="${activeRoleName}"] .badge`);
        if (badge) {
            badge.textContent = String(roleInfo.users.length);
        }
    });
}

function initTemplateVersionModal() {
    const modalElement = document.getElementById('templateVersionModal');
    if (!modalElement) return;

    const form = modalElement.querySelector('form');
    const templateSelect = modalElement.querySelector('[data-role="template-version-select"]');
    const versionInput = modalElement.querySelector('[data-role="template-version-input"]');
    if (!form || !templateSelect || !versionInput) return;

    const applySuggestion = (templateName, overrideVersion) => {
        if (!templateName) {
            versionInput.value = '';
            versionInput.placeholder = '请输入新版本号';
            return;
        }

        const current = getCurrentTemplateVersion(templateName, overrideVersion);
        const suggested = current > 0 ? current + 1 : 1;

        versionInput.value = String(suggested);
        versionInput.placeholder = `建议版本：${suggested}`;
        versionInput.min = 1;
        versionInput.step = 1;
    };

    modalElement.addEventListener('show.bs.modal', event => {
        syncTemplateRegistry(document);

        const trigger = event.relatedTarget;
        const triggerTemplate = trigger?.dataset.templateName || '';
        const triggerVersion = Number(trigger?.dataset.templateVersion);

        if (triggerTemplate) {
            templateSelect.value = triggerTemplate;
        }

        if (!templateSelect.value) {
            // Ensure a template is selected so that suggestion can be provided.
            const firstOption = templateSelect.querySelector('option');
            if (firstOption) {
                templateSelect.value = firstOption.value;
            }
        }

        applySuggestion(templateSelect.value, triggerVersion);
    });

    templateSelect.addEventListener('change', () => {
        applySuggestion(templateSelect.value);
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        form.reset();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();

        const templateName = templateSelect.value;
        const nextVersion = Number(versionInput.value);

        if (!templateName) {
            window.alert('请选择模板。');
            return;
        }

        if (Number.isNaN(nextVersion) || nextVersion < 1) {
            window.alert('请输入有效的版本号。');
            versionInput.focus();
            return;
        }

        setTemplateVersion(templateName, nextVersion);

        if (typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
            setTimeout(() => modalInstance.hide(), 300);
        }
    });
}

function initAppCreationModal() {
    const modalElement = document.getElementById('appAddModal');
    if (!modalElement) return;

    const form = modalElement.querySelector('#appCreateForm');
    const templateSelect = modalElement.querySelector('[data-role="app-template"]');
    const parameterPanel = setupParameterPanel(modalElement);

    if (!form || !parameterPanel) return;

    const setDefaultHint = () => {
        parameterPanel.setHint('参数由模板预置，仅需填写或选择参数值。', 'muted');
    };

    const loadTemplateParameters = templateId => {
        if (!templateId) {
            parameterPanel.clear();
            parameterPanel.setHint('请选择模板以查看部署参数。', 'muted');
            return;
        }

        const parameters = APP_TEMPLATE_PARAMETERS[templateId] || [];
        parameterPanel.renderParameters(parameters);

        if (parameters.length === 0) {
            parameterPanel.setHint('当前模板无需额外参数。', 'warning');
        } else {
            parameterPanel.setHint('模板已预置参数，仅需填写或选择参数值。', 'muted');
        }
    };

    templateSelect?.addEventListener('change', event => {
        loadTemplateParameters(event.target.value);
    });

    modalElement.addEventListener('show.bs.modal', () => {
        form.reset();
        if (templateSelect) {
            templateSelect.value = '';
        }
        parameterPanel.clear();
        parameterPanel.setHint('请选择模板以查看部署参数。', 'muted');
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        parameterPanel.clear();
        setDefaultHint();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
            setTimeout(() => modalInstance.hide(), 300);
        }
    });

    parameterPanel.updateEmptyState();
    setDefaultHint();
}

function initAppEditModal() {
    const modalElement = document.getElementById('appEditRequestModal');
    if (!modalElement) return;

    const form = modalElement.querySelector('#appEditForm');
    const appSelect = modalElement.querySelector('[data-role="app-edit-target"]');
    const templateDisplay = modalElement.querySelector('[data-role="app-edit-template"]');
    const templateIdInput = modalElement.querySelector('[data-role="app-edit-template-id"]');
    const appNameInput = modalElement.querySelector('[data-role="app-edit-name"]');
    const parameterPanel = setupParameterPanel(modalElement);
    const resourcePanel = setupResourcePanel(modalElement);

    if (!form || !appSelect || !parameterPanel || !resourcePanel) return;

    const populateOptions = () => {
        appSelect.innerHTML = '<option value="">请选择应用...</option>';
        Object.values(APPLICATION_DEPLOYMENTS).forEach(deployment => {
            const option = document.createElement('option');
            option.value = deployment.code;
            option.textContent = `${deployment.code} · ${deployment.name}`;
            appSelect.appendChild(option);
        });
    };

    const resetContext = () => {
        appSelect.value = '';
        if (templateDisplay) templateDisplay.value = '';
        if (templateIdInput) templateIdInput.value = '';
        if (appNameInput) appNameInput.value = '';
        parameterPanel.clear();
        parameterPanel.setHint('请选择应用以加载部署参数。', 'muted');
        resourcePanel.clear();
    };

    const applyDeployment = deployment => {
        if (!deployment) {
            resetContext();
            return;
        }

        if (templateDisplay) templateDisplay.value = deployment.templateName || '';
        if (templateIdInput) templateIdInput.value = deployment.templateId || '';
        if (appNameInput) appNameInput.value = deployment.name || '';

        const parameters = Array.isArray(deployment.parameters) && deployment.parameters.length > 0
            ? deployment.parameters
            : (APP_TEMPLATE_PARAMETERS[deployment.templateId] || []);

        parameterPanel.renderParameters(parameters);
        if (parameters.length === 0) {
            parameterPanel.setHint('当前模板无需额外参数。', 'warning');
        } else {
            parameterPanel.setHint('可调整部署参数的值。', 'muted');
        }

        const resources = getResourcesByFilter(deployment.tenant, deployment.name);
        resourcePanel.setContext({
            resources,
            tenant: deployment.tenant,
            app: deployment.name
        });
    };

    appSelect.addEventListener('change', event => {
        const deployment = APPLICATION_DEPLOYMENTS[event.target.value];
        applyDeployment(deployment);
    });

    modalElement.addEventListener('show.bs.modal', () => {
        populateOptions();
        resetContext();
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        parameterPanel.clear();
        parameterPanel.setHint('请选择应用以加载部署参数。', 'muted');
        resourcePanel.clear();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!appSelect.value) {
            appSelect.focus();
            return;
        }

        const validation = resourcePanel.validate();
        if (!validation.valid) {
            resourcePanel.setHint('资源名称与类型为必填项。', 'warning');
            validation.focus?.focus();
            return;
        }

        const deployment = APPLICATION_DEPLOYMENTS[appSelect.value];
        if (deployment) {
            const resources = resourcePanel.getResources();
            updateResourceInventoryForApp(deployment.name, deployment.tenant, resources);
            applyResourceFilters(deployment.tenant, deployment.name);
        }
        if (typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
            setTimeout(() => modalInstance.hide(), 300);
        }
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
    const addGroupBtn = modalElement.querySelector('[data-action="add-tenant-user-group"]');
    const groupSelect = modalElement.querySelector('[data-role="tenant-user-group-name"]');
    const groupRoleSelect = modalElement.querySelector('[data-role="tenant-user-group-role"]');
    let currentTenant = '';

    const setFeedback = (message, isError = false) => {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.toggle('text-danger', isError);
        feedback.classList.toggle('text-success', !isError);
    };

    const buildGroupOptions = () => {
        if (!groupSelect) return;
        groupSelect.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '选择用户组...';
        groupSelect.appendChild(placeholder);

        Object.entries(tenantUserGroups).forEach(([groupName, members]) => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = `${groupName} · ${members.length} 人`;
            groupSelect.appendChild(option);
        });
    };

    const buildGroupRoleOptions = () => {
        if (!groupRoleSelect) return;
        groupRoleSelect.innerHTML = '';

        tenantUserRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            groupRoleSelect.appendChild(option);
        });
    };

    const resetGroupControls = () => {
        if (groupSelect) {
            const options = [...groupSelect.options].filter(opt => opt.value !== '');
            groupSelect.value = options.length > 0 ? options[0].value : '';
        }
        if (groupRoleSelect && tenantUserRoles.length > 0) {
            groupRoleSelect.value = tenantUserRoles[0];
        }
    };

    addGroupBtn?.addEventListener('click', () => {
        if (!currentTenant) {
            setFeedback('请选择租户后再添加用户组。', true);
            return;
        }

        const groupName = groupSelect?.value || '';
        if (!groupName) {
            setFeedback('请选择一个用户组。', true);
            groupSelect?.focus();
            return;
        }

        const targetRole = groupRoleSelect?.value || '';
        if (!targetRole) {
            setFeedback('请选择要赋予的角色。', true);
            groupRoleSelect?.focus();
            return;
        }

        const groupMembers = tenantUserGroups[groupName] || [];
        if (groupMembers.length === 0) {
            setFeedback(`${groupName} 暂无成员可添加。`, true);
            return;
        }

        const users = getTenantUsers(currentTenant);
        let addedCount = 0;
        let updatedCount = 0;

        groupMembers.forEach(member => {
            const existing = users.find(user => user.email.toLowerCase() === member.email.toLowerCase());
            if (existing) {
                if (existing.role !== targetRole) {
                    existing.role = targetRole;
                    updatedCount += 1;
                }
            } else {
                users.push({ name: member.name, email: member.email, role: targetRole });
                addedCount += 1;
            }
        });

        renderTenantUsersTable(tableBody, currentTenant);

        if (addedCount === 0 && updatedCount === 0) {
            setFeedback(`${groupName} 的成员已全部存在，无需重复添加。`, true);
            return;
        }

        setFeedback(`已处理 ${groupName}：新增 ${addedCount} 人，更新 ${updatedCount} 人，角色均为 ${targetRole}。`);
    });

    modalElement.addEventListener('show.bs.modal', event => {
        const trigger = event.relatedTarget;
        currentTenant = trigger?.dataset.tenant || '';
        tenantLabel.textContent = currentTenant || '未选择租户';
        modalTitle.textContent = currentTenant ? `租户用户管理 - ${currentTenant}` : '租户用户管理';
        buildGroupOptions();
        buildGroupRoleOptions();
        if (form) {
            form.reset();
        }
        if (roleSelect) {
            roleSelect.value = tenantUserRoles[0];
        }
        resetGroupControls();
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

        const previousGroupValue = groupSelect?.value || '';
        const previousGroupRole = groupRoleSelect?.value || '';

        form.reset();

        if (roleSelect) {
            roleSelect.value = tenantUserRoles[0];
        }
        if (groupSelect) {
            groupSelect.value = previousGroupValue;
        }
        if (groupRoleSelect && previousGroupRole) {
            groupRoleSelect.value = previousGroupRole;
        } else if (groupRoleSelect) {
            groupRoleSelect.value = tenantUserRoles[0];
        }
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
    const tenantName = target.closest('tr')?.dataset.tenant || '';
    if (appName) {
        openTab('resources', '云资源', { tenant: tenantName, app: appName });
    }
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
    initTemplateVersionModal();
    initAppCreationModal();
    initAppEditModal();
    initTenantFormModal();
    initTenantUsersModal();
    bootstrapDefaultTabs();
});
