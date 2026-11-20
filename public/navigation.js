const menu = document.querySelector('.glass-menu');
if (menu) {
  const trigger = menu.querySelector('summary');
  const close = menu.querySelector('.glass-close');
  const search = menu.querySelector('input[type="search"]');
  const groups = [...menu.querySelectorAll('.glass-group')];
  const links = [...menu.querySelectorAll('nav a')];
  const empty = menu.querySelector('.glass-empty');
  const normalize = text => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const filter = () => {
    const term = normalize(search.value);
    for (const link of links) link.hidden = !normalize(link.textContent).includes(term);
    for (const group of groups) group.hidden = !group.querySelector('a:not([hidden])');
    empty.hidden = groups.some(group => !group.hidden);
  };

  function markCurrent() {
    const local = links.filter(link => link.pathname === location.pathname && link.hash);
    const destinations = local.map(link => ({ link, target: document.getElementById(link.hash.slice(1)) }))
      .filter(item => item.target)
      .sort((a, b) => a.target.offsetTop - b.target.offsetTop);
    const active = destinations.filter(({target}) => target.getBoundingClientRect().top <= innerHeight * .4).at(-1);
    for (const {link} of destinations) {
      if (link === active?.link) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
  }

  close.hidden = search.parentElement.hidden = false;
  close.addEventListener('click', () => { menu.open = false; trigger.focus(); });
  menu.addEventListener('toggle', () => {
    if (menu.open) markCurrent();
    else { search.value = ''; filter(); menu.querySelector('.glass-links').scrollTop = 0; }
  });
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
  });
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && search.value.trim()) {
      event.preventDefault();
      links.find(link => !link.hidden)?.click();
    }
  });
  document.addEventListener('novaire:languagechange', filter);
}
