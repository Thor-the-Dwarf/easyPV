class LayoutManager {
    constructor() {
        this.resizingInfo = null;
        this.handles = document.querySelectorAll('.resizer-handle');
        this.init();
    }

    init() {
        this.handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.startResizing(e, handle));
        });

        window.addEventListener('mousemove', (e) => this.resize(e));
        window.addEventListener('mouseup', () => this.stopResizing());
    }

    startResizing(e, handle) {
        e.preventDefault();
        const targetId = handle.dataset.target; // 'left', 'right', 'bottom'
        const targetElement = document.getElementById(targetId + '-drawer');

        if (!targetElement) {
            console.error(`LayoutManager: Target element #${targetId}-drawer not found!`);
            return;
        }

        this.resizingInfo = {
            target: targetElement,
            type: targetId, // 'left' | 'right' | 'bottom'
            startX: e.clientX,
            startY: e.clientY,
            startWidth: parseFloat(getComputedStyle(targetElement).width),
            startHeight: parseFloat(getComputedStyle(targetElement).height)
        };

        handle.classList.add('resizing');
        document.body.style.cursor = targetId === 'bottom' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection
    }

    resize(e) {
        if (!this.resizingInfo) return;

        const { target, type, startX, startY, startWidth, startHeight } = this.resizingInfo;
        const currentX = e.clientX;
        const currentY = e.clientY;

        if (type === 'left') {
            const newWidth = startWidth + (currentX - startX);
            // Min/Max Handling (CSS handles visual limits, but JS needs to set style)
            if (newWidth > 150 && newWidth < window.innerWidth / 2) {
                target.style.width = `${newWidth}px`;
            }
        } else if (type === 'right') {
            const newWidth = startWidth - (currentX - startX); // Negative delta for right side
            if (newWidth > 150 && newWidth < window.innerWidth / 2) {
                target.style.width = `${newWidth}px`;
            }
        } else if (type === 'bottom') {
            const newHeight = startHeight - (currentY - startY); // Negative delta for bottom up
            if (newHeight > 100 && newHeight < window.innerHeight / 2) {
                target.style.height = `${newHeight}px`;
                // Refresh CodeMirror if it exists
                if (window.sqlEditorInstance) {
                    window.sqlEditorInstance.refresh();
                }
            }
        }
    }

    stopResizing() {
        if (this.resizingInfo) {
            const handle = document.querySelector(`.resizer-handle[data-target="${this.resizingInfo.type}"]`);
            if (handle) handle.classList.remove('resizing');

            this.resizingInfo = null;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
        }
    }
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    new LayoutManager();
});
