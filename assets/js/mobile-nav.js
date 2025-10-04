
(function(){
  try {
    var nav = document.querySelector('.main-nav');
    var toggle = document.querySelector('.menu-toggle');
    if (nav && toggle) {
      toggle.addEventListener('click', function(){
        nav.classList.toggle('is-open');
      }, false);
    }
  } catch(e){}
})();
