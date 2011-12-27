(function($){
  $.fn.autoResizeInput = function(options) {
    var settings = $.extend({onResize: function(){}}, options);

    var keys = [
      "font-family",
      "font-size",
      "font-weight", 
      "padding-top",
      "padding-bottom",
      "padding-left",
      "padding-right", 
      "border-top-width",
      "border-bottom-width",
      "border-left-width",
      "border-right-width"
    ];

    this.filter('input[type="text"]').each(function(){
      var input_tag = $(this);

      var span_tag = $("<span style='display:none' />");
      //var span_tag = $("<span style='display:' />");
      $.each(keys, function() {
        span_tag.css("" + this, input_tag.css("" + this));
      });
      $("body").append(span_tag);

      var lastSize = 0;
      var resize = function() {
        span_tag.text(input_tag.val());
        span_tag.html(span_tag.html().replace(/ /g, "&nbsp;"));
        var size = span_tag.width();
        if (lastSize != size) {
          input_tag.width(size);
          lastSize = size;
          settings.onResize(input_tag, size);
        }
      };
      resize();

      var timer_id;
      input_tag.unbind('.artif');
      input_tag.bind('focus.artif', function() {
        timer_id = setInterval(resize, 100);
      });
      input_tag.bind('blur.artif', function() {
        clearInterval(timer_id);
      });
    });
    return this;
  };
})(jQuery);