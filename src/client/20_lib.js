		/* ============================ data access ============================ */
		var DATA_CACHE = null;
		var DATA_PROMISE = null;
		var INDEX_CACHE = null;
		var INDEX_PROMISE = null;

		function fetchJson(url) {
			return fetch(url, { credentials: 'same-origin' }).then(function (res) {
				if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + url);
				return res.json();
			});
		}

		function loadData() {
			if (DATA_CACHE !== null) return Promise.resolve(DATA_CACHE);
			if (DATA_PROMISE === null) {
				DATA_PROMISE = fetchJson(DATA_URL).then(function (json) {
					DATA_CACHE = json;
					return json;
				}).catch(function (err) {
					DATA_PROMISE = null;
					throw err;
				});
			}
			return DATA_PROMISE;
		}

		function loadIndex() {
			if (INDEX_CACHE !== null) return Promise.resolve(INDEX_CACHE);
			if (INDEX_PROMISE === null) {
				INDEX_PROMISE = fetchJson(INDEX_URL).then(function (json) {
					INDEX_CACHE = json;
					return json;
				}).catch(function (err) {
					INDEX_PROMISE = null;
					throw err;
				});
			}
			return INDEX_PROMISE;
		}

		/* ============================ formatting ============================ */
		var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		function isNum(n) {
			return typeof n === 'number' && isFinite(n);
		}

		function compact(n) {
			if (!isNum(n)) return '—';
			var a = Math.abs(n);
			if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
			if (a >= 1e8) return (n / 1e6).toFixed(0) + 'M';
			if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
			if (a >= 1e4) return (n / 1e3).toFixed(0) + 'K';
			if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
			return String(Math.round(n));
		}

		function grouped(n, digits) {
			if (!isNum(n)) return '—';
			var d = typeof digits === 'number' ? digits : 0;
			return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		}

		function pct(a, b) {
			if (!isNum(a) || !isNum(b) || b === 0) return '—';
			return ((a / b) * 100).toFixed(1) + '%';
		}

		function monthLabel(key) {
			if (!key) return '—';
			var parts = String(key).split('-');
			var mi = parseInt(parts[1], 10) - 1;
			if (mi < 0 || mi > 11) return String(key);
			return MONTHS[mi] + ' ' + String(parts[0]).slice(2);
		}

		function isoDate(value) {
			if (!value) return '—';
			return String(value).slice(0, 10);
		}

		function shortDate(value) {
			if (!value) return '—';
			var s = String(value).slice(0, 10);
			var parts = s.split('-');
			if (parts.length !== 3) return s;
			var mi = parseInt(parts[1], 10) - 1;
			return String(parseInt(parts[2], 10)) + ' ' + (MONTHS[mi] || '?') + ' ' + parts[0];
		}

		function daysBetween(a, b) {
			var t1 = Date.parse(a);
			var t2 = Date.parse(b);
			if (isNaN(t1) || isNaN(t2)) return null;
			return Math.round((t2 - t1) / 86400000);
		}

		function toEntries(obj) {
			var out = [];
			if (!obj || typeof obj !== 'object') return out;
			for (var k in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, k)) out.push([k, obj[k]]);
			}
			return out;
		}

		function sortEntriesAsc(obj) {
			return toEntries(obj).sort(function (a, b) { return String(a[0]) < String(b[0]) ? -1 : 1; });
		}

		function lastN(list, n) {
			if (!Array.isArray(list)) return [];
			return n >= list.length ? list.slice() : list.slice(list.length - n);
		}

		function sumBy(list, key) {
			var total = 0;
			(list || []).forEach(function (row) { if (isNum(row && row[key])) total += row[key]; });
			return total;
		}

		function topEntries(obj, n) {
			return toEntries(obj).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 8);
		}

		function truncate(text, max) {
			var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
			return s.length > max ? s.slice(0, max - 1) + '…' : s;
		}

		function debounce(fn, wait) {
			var timer = null;
			return function () {
				var args = arguments;
				var self = this;
				if (timer !== null) clearTimeout(timer);
				timer = setTimeout(function () { timer = null; fn.apply(self, args); }, wait || 140);
			};
		}

		/* ============================ icons (16px stroke) ============================ */
		function svgIcon(paths, size) {
			var s = size || 16;
			return h('svg', {
				width: s, height: s, viewBox: '0 0 16 16', fill: 'none',
				stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
				'aria-hidden': 'true'
			}, paths.map(function (d, i) { return h('path', { key: 'p' + i, d: d }); }));
		}

		var ICONS = {
			overview: ['M2.5 6.2 8 2.5l5.5 3.7V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V6.2Z', 'M6.2 13.5V9h3.6v4.5'],
			commercial: ['M2.5 12.5h11', 'M4 12.5V8m3.2 4.5V5.4m3.2 7.1V7m3.2 5.5V3.5'],
			correspondence: ['M2.5 4.2h11v7.6h-11z', 'm2.5 4.6 5.5 4 5.5-4'],
			meetings: ['M6 2.5v2M10 2.5v2', 'M2.5 5.5h11v8h-11z', 'M2.5 8.5h11'],
			quality: ['M8 1.8 13.8 4.4v3.9c0 3-2.4 5-5.8 6-3.4-1-5.8-3-5.8-6V4.4L8 1.8Z', 'm5.9 7.9 1.6 1.7 2.9-3'],
			documents: ['M4 2.5h5.2L12 5.3v8.2H4z', 'M9 2.6v3h3'],
			search: ['M7.2 12.2a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'm10.9 10.9 2.6 2.6'],
			chevron: ['m6 4 4 4-4 4'],
			collapse: ['M9.5 3.5 5.5 8l4 4.5'],
			back: ['M10 3.5 5.5 8l4.5 4.5']
		};

		function Icon(props) {
			return svgIcon(ICONS[props.name] || ICONS.overview, props.size);
		}

		/* ============================ shared atoms ============================ */
		function Card(props) {
			var cls = 'epc-card' + (props.className ? ' ' + props.className : '');
			return h('section', { className: cls },
				props.title !== undefined || props.note !== undefined
					? h('div', { className: 'epc-card-h' },
						h('span', { className: 'epc-card-t' }, props.title),
						props.badge || null,
						props.note !== undefined ? h('span', { className: 'epc-card-note' }, props.note) : null,
						props.actions || null)
					: null,
				h('div', { className: 'epc-card-b' + (props.flush ? ' flush' : '') + (props.fill ? ' fill' : '') }, props.children));
		}

		function Kpi(props) {
			var unit = props.unit ? h('span', { className: 'epc-kpi-u' }, props.unit) : null;
			/* Some figures are a sum of currency slices rather than one amount, so the
			   tile can carry extra amounts beneath the first: the largest slice keeps
			   the large figure and the others stack under it in the same mono face. */
			var lines = (props.lines || []).filter(function (l) { return l && l.value != null; });
			return h('div', { className: 'epc-kpi', title: props.hint || null },
				h('div', { className: 'epc-kpi-k' }, props.label),
				h('div', { className: 'epc-kpi-v' }, props.value, unit),
				lines.length > 0 ? h('div', { className: 'epc-kpi-m' }, lines.map(function (l, i) {
					return h('div', { className: 'epc-kpi-ml', key: 'k' + i },
						h('span', { className: 'mono' }, l.value),
						l.unit ? h('span', { className: 'epc-kpi-u' }, l.unit) : null);
				})) : null,
				h('div', { className: 'epc-kpi-s' }, props.sub || null));
		}

		function Pill(props) {
			return h('span', { className: 'epc-pill' + (props.tone ? ' ' + props.tone : '') },
				props.dot === false ? null : h('i', { className: 'epc-dot' }),
				props.children);
		}

		function ProgressBar(props) {
			var pctVal = isNum(props.value) ? Math.max(0, Math.min(1, props.value)) : 0;
			return h('div', { className: 'epc-prog', title: props.title || null },
				h('i', { style: { width: (pctVal * 100).toFixed(2) + '%', background: props.color || 'var(--epc-accent)' } }));
		}

		function ListBar(props) {
			var max = props.max || 1;
			var w = max > 0 ? Math.max(1.5, (props.value / max) * 100) : 0;
			return h('div', { className: 'epc-lbar' },
				h('span', { className: 'epc-lbar-k', title: props.label }, props.label),
				h('div', { className: 'epc-lbar-track' }, h('i', { className: 'epc-lbar-fill', style: { width: w.toFixed(2) + '%', background: props.color || 'var(--epc-accent)' } })),
				h('span', { className: 'epc-lbar-n' }, props.display || props.value));
		}

		function BarChart(props) {
			var data = props.data || [];
			var max = 1;
			data.forEach(function (d) { if (d[1] > max) max = d[1]; });
			return h('div', null,
				h('div', { className: 'epc-bars', style: props.height ? { height: props.height } : null },
					data.map(function (d) {
						var hp = max > 0 ? Math.max(2, (d[1] / max) * 100) : 2;
						return h('div', {
							key: d[0],
							className: 'epc-bar',
							style: { height: hp.toFixed(2) + '%', background: props.color || null },
							title: d[0] + ' · ' + d[1] + (props.unit ? ' ' + props.unit : '')
						});
					})),
				data.length > 0
					? h('div', { className: 'epc-bars-axis' },
						h('span', null, monthLabel(data[0][0])),
						data.length > 2 ? h('span', null, monthLabel(data[Math.floor(data.length / 2)][0])) : null,
						h('span', null, monthLabel(data[data.length - 1][0])))
					: h('div', { className: 'epc-empty' }, props.empty || 'No data'));
		}

		function Empty(props) {
			return h('div', { className: 'epc-empty' }, props.children || 'No records');
		}

		function Loading() {
			return h('div', { className: 'epc-loading' }, h('div', { className: 'epc-spin' }), h('div', null, t('app.loading')));
		}

		/* ============================ page scaffolding ============================ */
		function PageHead(props) {
			return h('div', { className: 'epc-head' },
				h('div', { className: 'epc-head-t' },
					h('h1', { className: 'epc-h1' }, props.title),
					props.sub ? h('div', { className: 'epc-sub' }, props.sub) : null),
				props.actions ? h('div', { className: 'epc-head-actions' }, props.actions) : null);
		}

		function KpiRow(props) {
			var cls = 'epc-grid epc-g' + (props.count || props.items.length);
			return h('div', { className: cls }, props.items.map(function (item, i) {
				return h(Kpi, Object.assign({ key: 'k' + i }, item));
			}));
		}
