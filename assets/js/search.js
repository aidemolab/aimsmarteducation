// Topic search: filters a local list in the browser. Nothing is sent anywhere.
// Paths are relative to the site root; ROOT is read from the input's data-root.

const TOPICS = [
  {
    title: 'Inside an Induction Motor',
    subject: 'Physics',
    level: 'A-level',
    path: 'physics/induction-motor/',
    keywords: 'induction motor ac three-phase three phase rotating magnetic field stator rotor squirrel cage induced current electromagnetic induction torque slip faraday lenz electromagnetism',
  },
];

function normalise(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function search(query) {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return TOPICS.filter((topic) => {
    const haystack = normalise(`${topic.title} ${topic.subject} ${topic.level} ${topic.keywords}`);
    return words.every((word) => haystack.includes(word));
  });
}

function initSearch(input) {
  const root = input.dataset.root || './';
  const list = document.getElementById(input.getAttribute('aria-controls'));
  const status = document.getElementById(input.dataset.status);

  function render() {
    const query = input.value.trim();
    list.replaceChildren();
    if (!query) {
      list.hidden = true;
      status.textContent = '';
      return;
    }
    const results = search(query);
    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = `No topics match "${query}" yet. We're adding more all the time.`;
      list.append(li);
    }
    for (const topic of results) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = root + topic.path;
      const title = document.createElement('span');
      title.className = 'result-title';
      title.textContent = topic.title;
      const meta = document.createElement('span');
      meta.className = 'result-meta';
      meta.textContent = `${topic.subject} · ${topic.level}`;
      a.append(title, meta);
      li.append(a);
      list.append(li);
    }
    list.hidden = false;
    status.textContent = results.length === 1 ? '1 topic found' : `${results.length} topics found`;
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = list.querySelector('a');
      if (first) first.click();
    } else if (event.key === 'ArrowDown') {
      const first = list.querySelector('a');
      if (first) { event.preventDefault(); first.focus(); }
    } else if (event.key === 'Escape') {
      input.value = '';
      render();
    }
  });

  for (const chip of document.querySelectorAll('[data-search-hint]')) {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.searchHint;
      render();
      input.focus();
    });
  }
}

document.querySelectorAll('input[data-topic-search]').forEach(initSearch);
