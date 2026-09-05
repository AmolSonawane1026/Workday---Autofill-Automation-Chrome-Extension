export class WorkdayOverlayAssistant {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.container = null;
    this.shadowRoot = null;
    this.state = {
      isMinimized: false,
      stepName: 'Detecting...',
      stepNumber: 1,
      totalFields: 0,
      filledFields: 0,
      statusMessage: 'Ready',
      isProcessing: false,
      mappings: []
    };
  }

  mount() {
    if (document.getElementById('workday-ai-assistant-root')) return;

    this.container = document.createElement('div');
    this.container.id = 'workday-ai-assistant-root';
    this.container.style.position = 'fixed';
    this.container.style.bottom = '20px';
    this.container.style.right = '20px';
    this.container.style.zIndex = '2147483647';
    this.container.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });
    document.body.appendChild(this.container);

    this.render();
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  render() {
    if (!this.shadowRoot) return;

    const { isMinimized, stepName, stepNumber, totalFields, filledFields, statusMessage, isProcessing } = this.state;

    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .assistant-card {
          background: #ffffff;
          color: #0f172a;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.08);
          width: ${isMinimized ? 'auto' : '320px'};
          overflow: hidden;
          transition: all 0.2s ease;
          border: 1px solid #e2e8f0;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .logo-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2563eb;
        }

        .title {
          font-weight: 600;
          font-size: 13px;
          color: #0f172a;
        }

        .btn-icon {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          font-size: 12px;
          border-radius: 4px;
        }
        .btn-icon:hover {
          color: #0f172a;
          background: #e2e8f0;
        }

        .body {
          display: ${isMinimized ? 'none' : 'block'};
          padding: 14px;
        }

        .step-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          margin-bottom: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .stat-box {
          background: #f8fafc;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .stat-label {
          font-size: 11px;
          color: #64748b;
        }

        .stat-value {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin-top: 2px;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.15s;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #e2e8f0;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .btn-secondary:hover {
          background: #f1f5f9;
        }

        .status-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
          font-size: 11px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
      </style>

      <div class="assistant-card">
        <div class="header" id="toggle-minimize">
          <div class="logo-box">
            <div class="badge-dot"></div>
            <div class="title">Workday Assistant</div>
          </div>
          <button class="btn-icon" id="btn-min">
            ${isMinimized ? '▲' : '▼'}
          </button>
        </div>

        <div class="body">
          <div class="step-pill">
            <span>Step ${stepNumber}:</span>
            <span>${stepName}</span>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-label">Detected Fields</div>
              <div class="stat-value">${totalFields}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Filled Fields</div>
              <div class="stat-value">${filledFields}</div>
            </div>
          </div>

          <div class="actions">
            <button class="btn-primary" id="btn-autofill" ${isProcessing ? 'disabled' : ''}>
              ${isProcessing ? 'Autofilling...' : 'Autofill Form Step'}
            </button>
            <button class="btn-secondary" id="btn-scan">
              Scan Page Fields
            </button>
          </div>

          <div class="status-footer">
            <span>${statusMessage}</span>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('toggle-minimize')?.addEventListener('click', (e) => {
      if (e.target.id !== 'btn-min') {
        this.updateState({ isMinimized: !this.state.isMinimized });
      }
    });

    this.shadowRoot.getElementById('btn-min')?.addEventListener('click', () => {
      this.updateState({ isMinimized: !this.state.isMinimized });
    });

    this.shadowRoot.getElementById('btn-autofill')?.addEventListener('click', () => {
      if (this.handlers.onAutofill) {
        this.handlers.onAutofill();
      }
    });

    this.shadowRoot.getElementById('btn-scan')?.addEventListener('click', () => {
      if (this.handlers.onScan) {
        this.handlers.onScan();
      }
    });
  }
}
