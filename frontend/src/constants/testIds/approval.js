// Test IDs for the HITL approval queue dashboard. Naming follows ./auth.js.

export const APPROVAL = {
        page: 'approval-page',
        statTotal: 'stat-total-orders',
        statPending: 'stat-pending-approval',
        statCompleted: 'stat-completed-sales',
        feed: 'approval-queue-feed',
        feedCount: 'approval-queue-count',
        chatPreview: 'live-chat-preview',
        chatLog: 'live-chat-log',
        decisionCard: 'order-decision-card',
        orderTotal: 'order-decision-total',
        approveButton: 'order-approve-button',
        rejectButton: 'order-reject-button',
        failureAlert: 'order-failure-alert',
        rejectReasonText: 'order-reject-reason-text',
        rejectForm: 'reject-reason-form',
        rejectReasonInput: 'reject-reason-input',
        rejectReasonError: 'reject-reason-error',
        rejectConfirmButton: 'reject-confirm-button',
        rejectCancelButton: 'reject-cancel-button',
        inventory: 'inventory-panel',
        audit: 'audit-trail',
        aiInsight: 'order-ai-insight',
        aiBadge: 'order-ai-badge',
        aiConfidence: 'order-ai-confidence',
        aiModel: 'order-ai-model',
        aiReasoning: 'order-ai-reasoning',
        aiExtracted: 'order-ai-extracted',
};

export const chatDraftBadgeId = (messageId) => `chat-draft-badge-${messageId.toLowerCase()}`;

export const approvalItemId = (orderId) => `queue-item-${orderId.toLowerCase()}`;
export const presetReasonId = (index) => `reject-preset-reason-${index}`;
export const stockId = (sku) => `inventory-stock-${sku.toLowerCase()}`;
export const chatMessageId = (messageId) => `chat-message-${messageId.toLowerCase()}`;
