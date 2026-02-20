#!/bin/bash
sed -i '' -e '/<!-- Drawer-Toggle-Buttons (schweben am rechten Rand) --/,/<\/aside>/c\
    <!-- Drawer-Toggle-Buttons (schweben am rechten Rand) -->\
    <div id="drawer-toggles">\
        <button class="btn-drawer-toggle" data-target="drawer-prefix-visualizer" aria-expanded="false" title="Präfix-Visualizer">\
            <span class="drawer-toggle-icon">🔬</span>\
            <span class="drawer-toggle-label" aria-hidden="true">Visualizer</span>\
        </button>\
        <button class="btn-drawer-toggle" data-target="drawer-host-slicer" aria-expanded="false" title="Host-Rechner">\
            <span class="drawer-toggle-icon">💻</span>\
            <span class="drawer-toggle-label" aria-hidden="true">Hosts</span>\
        </button>\
        <button class="btn-drawer-toggle" data-target="drawer-subnet-slicer" aria-expanded="false" title="Subnetz-Rechner">\
            <span class="drawer-toggle-icon">🧮</span>\
            <span class="drawer-toggle-label" aria-hidden="true">Subnetze</span>\
        </button>\
        <button class="btn-drawer-toggle" id="btn-context-tools" data-target="drawer-tools" aria-expanded="false" title="Weitere Tools" style="display:none;">\
            <span class="drawer-toggle-icon">🔧</span>\
            <span class="drawer-toggle-label" aria-hidden="true">Tools</span>\
        </button>\
    </div>\
\
    <!-- Drawer-Backdrop -->\
    <div id="drawer-backdrop" aria-hidden="true" hidden></div>\
\
    <aside id="drawer-prefix-visualizer" class="tool-panel" aria-hidden="true">\
        <div class="tool-panel-header">\
            <h2 class="tool-panel-title">Präfix-Visualizer</h2>\
            <button class="btn-drawer-close">✕</button>\
        </div>\
        <div class="tool-panel-content" id="slot-prefix-visualizer"></div>\
    </aside>\
\
    <aside id="drawer-host-slicer" class="tool-panel" aria-hidden="true">\
        <div class="tool-panel-header">\
            <h2 class="tool-panel-title">Host-Rechner</h2>\
            <button class="btn-drawer-close">✕</button>\
        </div>\
        <div class="tool-panel-content" id="slot-host-slicer"></div>\
    </aside>\
\
    <aside id="drawer-subnet-slicer" class="tool-panel" aria-hidden="true">\
        <div class="tool-panel-header">\
            <h2 class="tool-panel-title">Subnetz-Rechner</h2>\
            <button class="btn-drawer-close">✕</button>\
        </div>\
        <div class="tool-panel-content" id="slot-subnet-slicer"></div>\
    </aside>\
\
    <aside id="drawer-tools" class="tool-panel" aria-hidden="true">\
        <div class="tool-panel-header">\
            <h2 id="tool-panel-title">Weitere Tools</h2>\
            <button class="btn-drawer-close">✕</button>\
        </div>\
        <div id="tool-panel-content" class="tool-panel-content"></div>\
    </aside>\
' index.html
