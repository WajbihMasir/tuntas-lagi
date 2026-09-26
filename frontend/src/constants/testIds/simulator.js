// Test IDs for the WhatsApp webhook simulator drawer and the demo reset control.

export const SIMULATOR = {
        openButton: 'wa-simulator-open-button',
        panel: 'wa-simulator-panel',
        closeButton: 'wa-simulator-close-button',
        aliasInput: 'wa-free-alias-input',
        textInput: 'wa-free-text-input',
        sendButton: 'wa-free-send-button',
        log: 'wa-simulator-log',
        logEmpty: 'wa-simulator-log-empty',
        resetTrigger: 'demo-reset-trigger',
        resetDialog: 'demo-reset-dialog',
        resetConfirm: 'demo-reset-confirm-button',
        resetCancel: 'demo-reset-cancel-button',
};

export const simulatorPresetId = (presetId) => `wa-preset-${presetId}`;
export const simulatorLogEntryId = (index) => `wa-log-entry-${index}`;
