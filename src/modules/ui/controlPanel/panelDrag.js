export const panelDrag = {
  init(panel) {
    let isDragging = false;
    let startX;
    let startY;
    let initialLeft;
    let initialTop;

    panel.on('mousedown', function handleMouseDown(event) {
      const interactiveControl = $(event.target).closest(
        'button, input, select, textarea, .color-option, .control-btn, .control-select, .range-input, .panel-resizer'
      );

      if (interactiveControl.length) {
        return;
      }

      isDragging = true;
      panel.addClass('dragging');

      startX = event.clientX;
      startY = event.clientY;

      const rect = panel[0].getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      event.preventDefault();
    });

    $(document).on('mousemove', function handleMouseMove(event) {
      if (!isDragging) {
        return;
      }

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const newLeft = initialLeft + deltaX;
      const newTop = initialTop + deltaY;
      const maxX = window.innerWidth - panel.outerWidth();
      const maxY = window.innerHeight - panel.outerHeight();

      panel.css({
        left: `${Math.max(0, Math.min(newLeft, maxX))}px`,
        top: `${Math.max(0, Math.min(newTop, maxY))}px`,
        transform: 'none'
      });
    });

    $(document).on('mouseup', function handleMouseUp() {
      if (!isDragging) {
        return;
      }

      isDragging = false;
      panel.removeClass('dragging');
      GM_setValue('control_panel_position', {
        left: parseInt(panel.css('left'), 10),
        top: parseInt(panel.css('top'), 10)
      });
    });

    const savedPosition = GM_getValue('control_panel_position');
    if (savedPosition) {
      const left = Math.max(0, Math.min(parseInt(savedPosition.left, 10) || 0, window.innerWidth - panel.outerWidth()));
      const top = Math.max(0, Math.min(parseInt(savedPosition.top, 10) || 0, window.innerHeight - panel.outerHeight()));
      panel.css({
        left: `${left}px`,
        top: `${top}px`,
        transform: 'none'
      });
    }
  }
};
