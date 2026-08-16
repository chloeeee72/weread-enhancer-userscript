export const notificationManager = {
  currentNotification: null,
  timeoutId: null,

  show: function (message, duration = 1000) {
    this.clear();
    this.currentNotification = $(`<div class="custom-notification">${message}</div>`);
    $('body').append(this.currentNotification);

    this.timeoutId = setTimeout(() => this.close(), duration);
  },

  close: function () {
    const element = this.currentNotification;
    element?.addClass('fade-out');
    setTimeout(() => {
      element?.remove();
      if (this.currentNotification === element) {
        this.currentNotification = null;
      }
    }, 300);

    this.timeoutId && clearTimeout(this.timeoutId);
    this.timeoutId = null;
  },

  clear: function () {
    this.close();
    $('.custom-notification').remove();
  }
};
