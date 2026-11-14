		/* ============================ command palette ============================ */
		function CommandPalette(props) {
			var index = useIndex();
			var [query, setQuery] = useState('');
			var [cursor, setCursor] = useState(0);
			var inputRef = useRef(null);

			useEffect(function () {
				if (inputRef.current && typeof inputRef.current.focus === 'function') inputRef.current.focus();
			}, []);

			var total = index.data ? index.data.length : 0;

			var results = useMemo(function () {
				if (!index.data) return [];
				var q = query.trim().toLowerCase();
				if (q === '') {
					return index.data.slice().sort(function (a, b) {
						var da = String(a[2] || '');
						var db = String(b[2] || '');
						return da < db ? 1 : da > db ? -1 : 0;
					}).slice(0, 40);
				}
				var terms = q.split(/\s+/).filter(Boolean);
				var scored = [];
				for (var i = 0; i < index.data.length; i += 1) {
					var row = index.data[i];
					var hay = (String(row[1] || '') + ' ' + String(row[3] || '') + ' ' + String(row[2] || '')).toLowerCase();
					var ok = true;
					for (var j = 0; j < terms.length; j += 1) {
						if (hay.indexOf(terms[j]) < 0) { ok = false; break; }
					}
					if (!ok) continue;
					var score = hay.indexOf(q) >= 0 ? 0 : 1;
					scored.push([score, row]);
					if (scored.length > 400) break;
				}
				scored.sort(function (a, b) {
					if (a[0] !== b[0]) return a[0] - b[0];
					var da = String(a[1][2] || '');
					var db = String(b[1][2] || '');
					return da < db ? 1 : da > db ? -1 : 0;
				});
				return scored.slice(0, 60).map(function (pair) { return pair[1]; });
			}, [index.data, query]);

			useEffect(function () { setCursor(0); }, [query]);

			function onKeyDown(e) {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					setCursor(function (c) { return Math.min(c + 1, results.length - 1); });
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					setCursor(function (c) { return Math.max(c - 1, 0); });
				} else if (e.key === 'Escape') {
					e.preventDefault();
					props.onClose();
				} else if (e.key === 'Enter' && results[cursor]) {
					e.preventDefault();
					props.onSelect(results[cursor]);
				}
			}

			return h('div', {
				className: 'epc-pal-mask',
				onMouseDown: function (e) { if (e.target === e.currentTarget) props.onClose(); }
			},
				h('div', { className: 'epc-pal', onKeyDown: onKeyDown },
					h('div', { className: 'epc-pal-in' },
						h('span', { style: { color: 'var(--epc-dim)', display: 'grid', placeItems: 'center' } }, h(Icon, { name: 'search', size: 15 })),
						h('input', {
							ref: inputRef,
							value: query,
							placeholder: index.data ? t('pal.placeholder', { n: grouped(total) }) : t('app.loading'),
							onChange: function (e) { setQuery(e.target.value); }
						}),
						h('span', { className: 'epc-kbd' }, 'esc')),
					h('div', { className: 'epc-pal-list' },
						index.error ? h('div', { className: 'epc-empty' }, t('app.error')) : null,
						!index.data && !index.error ? h(Loading) : null,
						index.data && results.length === 0 ? h('div', { className: 'epc-empty' }, t('pal.empty')) : null,
						results.map(function (row, i) {
							var kind = row[0];
							return h('div', {
								key: String(row[5] || '') + i,
								className: 'epc-pal-row' + (i === cursor ? ' sel' : ''),
								onMouseEnter: function () { setCursor(i); },
								onClick: function () { props.onSelect(row); }
							},
								h('span', { className: 'epc-pal-k' }, t('kind.' + kind)),
								h('span', { className: 'epc-pal-t' }, String(row[1] || '') + ' — ' + truncate(row[3], 80)),
								h('span', { className: 'epc-pal-d' }, shortDate(row[2])));
						})),
					h('div', { className: 'epc-pal-f' },
						h('span', null, t('pal.hint')),
						h('span', { className: 'grow', style: { flex: 1 } }),
						h('span', null, results.length + ' / ' + grouped(total)))));
		}

		/* ============================ sidebar icon ============================ */
		function PanelIcon(props) {
			var size = props && typeof props.size === 'number' ? props.size : 16;
			return h('svg', {
				width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
				stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
				'aria-hidden': 'true'
			},
				h('path', { d: 'M2.2 12.8h11.6' }),
				h('path', { d: 'M3.8 12.8V6.4l4.2-3.2 4.2 3.2v6.4' }),
				h('path', { d: 'M6.4 12.8V9.3h3.2v3.5' }),
				h('path', { d: 'M2.2 4.6h3.1' }),
				h('path', { d: 'M10.7 4.6h3.1' }));
		}

		/* ============================ shell ============================ */
		var VIEWS = [
			{ id: 'overview', cluster: 'project', icon: 'overview' },
			{ id: 'commercial', cluster: 'delivery', icon: 'commercial' },
			{ id: 'correspondence', cluster: 'records', icon: 'correspondence' },
			{ id: 'meetings', cluster: 'records', icon: 'meetings' },
			{ id: 'quality', cluster: 'delivery', icon: 'quality' },
			{ id: 'documents', cluster: 'records', icon: 'documents' }
		];

		/* Every record the dataset carries: letters, minutes, defects, subcontract
		   certificates and main-contract IPAs. Kept in one place so the statusbar
		   cannot drift away from the search index. */
		function recordCount(data) {
			var n = 0;
			n += (data.letters && data.letters.total) || 0;
			n += (data.meetings && data.meetings.total) || 0;
			n += (data.defects && data.defects.total) || 0;
			n += (data.payments && data.payments.ipcs ? data.payments.ipcs.length : 0);
			n += (data.mainContract && data.mainContract.ipas ? data.mainContract.ipas.length : 0);
			/* the signed certificate scans are indexed too, so they belong in the
			   count — without them the statusbar drifts below the index total */
			n += (data.mainContract && data.mainContract.scans ? data.mainContract.scans.length : 0);
			return n;
		}

		/* ============================ project folder ============================ */
		/* The workbench ships with a synthetic dataset so a fresh install shows a
		   working page. Reading a real project means pointing it at that project's
		   folder: the choice is made here and the reading happens in the host half,
		   because a page cannot open the filesystem by itself. */
		function sourceName(active) {
			if (!active) return t('src.bundled');
			if (active.source !== 'folder') return t('src.bundled');
			if (active.folder) {
				var parts = String(active.folder).split(/[\\/]/).filter(function (s) { return s !== ''; });
				return parts.length > 0 ? parts[parts.length - 1] : String(active.folder);
			}
			return t('src.folder');
		}

		function SourceBar(props) {
			var active = props.active;
			var busy = props.busy;
			var error = props.error;
			var isFolder = active && active.source === 'folder';
			return h('div', { className: 'epc-src' + (isFolder ? ' on' : '') },
				h('span', { className: 'epc-src-k' }, t('src.title')),
				h('span', { className: 'epc-src-v' },
					h('span', { className: 'epc-src-name' }, sourceName(active)),
					isFolder && active.builtAt
						? h('span', { className: 'epc-src-when' }, t('src.read', { date: shortDate(String(active.builtAt).slice(0, 10)) }))
						: h('span', { className: 'epc-src-when' }, t('src.bundled.note'))),
				error !== null && error !== void 0
					? h('span', { className: 'epc-src-err', title: String(error) }, t('src.failed'))
					: null,
				busy
					? h('span', { className: 'epc-src-busy' }, h('i', { className: 'epc-dot' }), t('src.reading'))
					: null,
				h('span', { className: 'grow' }),
				busy ? null : h('button', {
					className: 'epc-btn',
					onClick: props.onPick,
					title: t('src.pick.hint')
				}, t('src.pick')),
				!busy && isFolder ? h('button', {
					className: 'epc-btn',
					onClick: props.onReset,
					title: t('src.reset.hint')
				}, t('src.reset')) : null);
		}

		function Workbench(props) {
			/* The scope is an empty placeholder until the data arrives: the contract
			   ids come from the dataset, so there is no id to default to at compile
			   time. registerScope() below resolves it as soon as the payload is in. */
			var [state, setState] = useState({ status: 'loading', data: null, error: null });
			var [view, setView] = useState('overview');
			var [mini, setMini] = useState(false);
			var [palette, setPalette] = useState(false);
			var [scope, setScope] = useState('');
			/* What the host is serving and whether it is reading a folder right
			   now. Both come from the host half, so the button state and the page
			   cannot disagree about which project is on screen. */
			var [source, setSource] = useState({ active: null, build: null });
			var [reading, setReading] = useState(false);
			var [sourceError, setSourceError] = useState(null);
			var [readProgress, setReadProgress] = useState('');

			function load() {
				setState({ status: 'loading', data: null, error: null });
				loadData().then(function (data) {
					setState({ status: 'ready', data: data, error: null });
				}).catch(function (err) {
					setState({ status: 'error', data: null, error: err });
				});
			}

			useEffect(load, []);

			/* The host answers /state with what it is serving. Asking once on mount
			   keeps the strip honest after a reload, when the previously picked
			   folder is still the one being served. */
			function readState() {
				return fetch(STATE_URL, { credentials: 'same-origin' })
					.then(function (res) { return res.ok ? res.json() : null; })
					.then(function (json) { if (json) setSource(json); return json; })
					.catch(function () { return null; });
			}

			useEffect(function () { readState(); }, []);

			/* The register arrives with the payload, so the selected contract is
			   settled here rather than in the initial state. A scope that no longer
			   exists after a rebuild falls back to the main contract instead of
			   leaving every page blank. */
			useEffect(function () {
				if (state.status !== 'ready' || !state.data) return;
				var next = resolveScope(state.data, scope);
				if (next && next !== scope) setScope(next);
			}, [state.status, state.data]);

			/* Picking a folder is: choose it, tell the host, wait for the build, then
			   drop the cached parse and reload. Reading a real project takes a
			   minute or two, so the wait is a poll of /state rather than one long
			   request that a proxy could time out. */
			function pickFolder() {
				var workspace = typeof props.ctx.get === 'function' ? props.ctx.get('uiWorkspace') : null;
				if (!workspace || typeof workspace.pickDirectory !== 'function') {
					setSourceError(t('src.no.picker'));
					return;
				}
				setSourceError(null);
				Promise.resolve(workspace.pickDirectory()).then(function (folder) {
					if (!folder) return null;
					setReading(true);
					setReadProgress(t('src.reading'));
					return postJson(FOLDER_URL, { folder: folder }).then(function () {
						return waitForBuild(folder, 0);
					});
				}).catch(function (err) {
					setReading(false);
					setSourceError(String(err && err.message ? err.message : err));
				});
			}

			function waitForBuild(folder, tries) {
				return readState().then(function (json) {
					var b = json && json.build ? json.build : null;
					if (b && b.progress) {
						var line = String(b.progress).split(/\r?\n/).filter(function (s) { return s.trim() !== ''; });
						if (line.length > 0) setReadProgress(line[line.length - 1].trim().slice(0, 120));
					}
					if (b && b.status === 'running' && tries < 600) {
						return new Promise(function (resolve) { setTimeout(resolve, 1000); })
							.then(function () { return waitForBuild(folder, tries + 1); });
					}
					setReading(false);
					if (b && b.status === 'error') {
						setSourceError(b.error || t('src.failed'));
						return null;
					}
					resetData();
					load();
					return null;
				});
			}

			function resetSource() {
				setReading(false);
				setSourceError(null);
				postJson(RESET_URL, {}).then(function () {
					resetData();
					load();
					readState();
				}).catch(function (err) {
					setSourceError(String(err && err.message ? err.message : err));
				});
			}

			useEffect(function () {
				function onKey(e) {
					if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
						e.preventDefault();
						setPalette(function (p) { return !p; });
					} else if (e.key === 'Escape' && palette) {
						setPalette(false);
					}
				}
				window.addEventListener('keydown', onKey);
				return function () { window.removeEventListener('keydown', onKey); };
			}, [palette]);

			var data = state.data;
			var counts = data ? {
				correspondence: data.letters.total,
				meetings: data.meetings.total,
				quality: data.defects.openCount,
				documents: data.docs.contracts.length + data.docs.toc.length + data.docs.materials.length
			} : {};

			var clusters = useMemo(function () {
				var order = ['project', 'delivery', 'records'];
				var map = {};
				order.forEach(function (c) { map[c] = []; });
				VIEWS.forEach(function (v) { (map[v.cluster] || (map[v.cluster] = [])).push(v); });
				return order.map(function (c) { return [c, map[c] || []]; }).filter(function (e) { return e[1].length > 0; });
			}, []);

			function onSelectResult(row) {
				setPalette(false);
				var kind = row[0];
				/* A hit knows which contract it belongs to (the tag column of the
				   index), so a palette jump also moves the register strip. */
				var tag = row[4];
				if (tag && scopeIds(data).indexOf(tag) >= 0) setScope(tag);
				if (kind === 'L') setView('correspondence');
				else if (kind === 'M') setView('meetings');
				else if (kind === 'D') setView('quality');
				else if (kind === 'I') setView('commercial');
				else if (kind === 'C') { setScope(mainScopeId(data)); setView('commercial'); }
				else if (kind === 'S') { setScope(mainScopeId(data)); setView('documents'); }
			}

			var body = null;
			if (reading) {
				body = h('div', { className: 'epc-wait' },
					h('div', { className: 'epc-wait-k' }, t('src.reading')),
					h('div', { className: 'epc-wait-l' }, readProgress || t('src.reading.hint')));
			} else if (state.status === 'loading') body = h(Loading);
			else if (state.status === 'error') {
				body = h('div', { className: 'epc-err' },
					t('app.error'), h('br'),
					h('code', null, String(state.error && state.error.message ? state.error.message : state.error)),
					h('div', { style: { marginTop: '10px' } },
						h('button', { className: 'epc-btn primary', onClick: load }, t('app.retry'))));
			} else {
				/* Every view takes the same scope pair, so the register strip on
				   each page switches all of them and the selection survives a
				   change of view. */
				var pass = { data: data, scope: scope, onScope: setScope };
				if (view === 'overview') body = h(ViewOverview, pass);
				else if (view === 'commercial') body = h(ViewCommercial, pass);
				else if (view === 'correspondence') body = h(ViewCorrespondence, pass);
				else if (view === 'meetings') body = h(ViewMeetings, pass);
				else if (view === 'quality') body = h(ViewQuality, pass);
				else body = h(ViewDocuments, pass);
			}

			/* The chrome follows the selected contract as well: a page whose
			   register strip says "main contract" must not caption itself with
			   a subcontract number in the topbar and statusbar. */
			var markSub = 'EPC · ' + contractLabel(data, scope);
			var flowLabel = scopeFlow(data, scope);
			var scopeContract = data ? contractById(data, scope) : null;
			var scopeNo = scopeContract !== null && scopeContract !== void 0 ? scopeContract.no : null;
			var markGlyph = (data && data.project && data.project.mark) || 'EPC';
			var projectShort = (data && data.project && data.project.short) || t('nav.panel');

			return h('div', { className: 'epc-root' },
				h('div', { className: 'epc-top' },
					h('div', { className: 'epc-mark' },
						h('div', { className: 'epc-mark-glyph' }, markGlyph),
						h('div', { style: { display: 'flex', flexDirection: 'column', lineHeight: 1.15 } },
							h('span', { className: 'epc-mark-name' }, t('nav.panel')),
							h('span', { className: 'epc-mark-sub' }, markSub))),
					h('div', { className: 'epc-crumbs' },
						h('span', null, projectShort),
						h('span', { className: 'epc-crumb-sep' }, '/'),
						h('b', null, t('view.' + view))),
					h('div', { className: 'epc-top-spacer' }),
					h('button', {
						className: 'epc-searchbtn',
						onClick: function () { setPalette(true); },
						title: t('action.search')
					},
						h(Icon, { name: 'search', size: 13 }),
						h('span', null, t('action.search')),
						h('span', { className: 'epc-kbd', style: { marginLeft: 'auto' } }, '⌘K')),
					h('button', {
						className: 'epc-iconbtn',
						onClick: function () {
							var layout = typeof props.ctx.get === 'function' ? props.ctx.get('layout') : null;
							if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null);
						},
						title: t('action.back')
					}, h(Icon, { name: 'back', size: 14 }))),

				h('div', { className: 'epc-body' },
					h('nav', { className: 'epc-rail' + (mini ? ' mini' : '') },
						clusters.map(function (pair) {
							return h('div', { key: pair[0] },
								h('div', { className: 'epc-cluster' }, t('cluster.' + pair[0])),
								pair[1].map(function (v) {
									var count = counts[v.id];
									return h('button', {
										key: v.id,
										className: 'epc-navitem' + (view === v.id ? ' on' : ''),
										onClick: function () { setView(v.id); },
										title: t('view.' + v.id)
									},
										h('span', { className: 'epc-navglyph' }, h(Icon, { name: v.icon, size: 15 })),
										h('span', { className: 'epc-navlabel' }, t('view.' + v.id)),
										!mini && count !== undefined && v.id === 'quality' && count > 0
											? h('span', { className: 'epc-badge' }, count > 999 ? '999+' : String(count))
											: null);
								}));
						}),
						h('div', { className: 'epc-railtoggle' },
							h('button', {
								className: 'epc-navitem',
								onClick: function () { setMini(!mini); },
								title: mini ? t('action.expand') : t('action.collapse')
							},
								h('span', { className: 'epc-navglyph' }, h(Icon, { name: 'collapse', size: 15 })),
								h('span', { className: 'epc-navlabel' }, mini ? t('action.expand') : t('action.collapse'))))),

					h('div', { className: 'epc-stage' },
						h('div', { className: 'epc-sourcebar' },
							h(SourceBar, {
								active: source && source.active ? source.active : null,
								busy: reading,
								error: sourceError,
								onPick: pickFolder,
								onReset: resetSource
							})),
						h('div', { className: 'epc-scroll' }, body))),

				h('div', { className: 'epc-status' },
					h('span', { className: 'epc-live' }, h('i', { className: 'epc-dot' }), t('status.live')),
					data ? h('span', null, t('status.records', { n: grouped(recordCount(data)) })) : null,
					data ? h('span', null, t('status.data', { date: isoDate(data.generated) })) : null,
					h('span', { className: 'grow' }),
					h('div', { className: 'epc-status-r' },
						scopeNo !== null ? h('em', null, scopeNo) : null,
						data ? h('em', null, flowLabel) : null)),

				palette ? h(CommandPalette, { onClose: function () { setPalette(false); }, onSelect: onSelectResult }) : null);
		}

		/* ============================ styles ============================ */
		function injectCss() {
			if (typeof document === 'undefined') return;
			var id = 'dsh-epc-workbench/style.css';
			var existing = document.querySelector('style[data-plugin-css="' + id + '"]');
			if (existing !== null) { existing.textContent = CSS; return; }
			var el = document.createElement('style');
			el.dataset.plugin = 'dsh-epc-workbench';
			el.dataset.pluginCss = id;
			el.textContent = CSS;
			document.head.appendChild(el);
		}

		/* ============================ apply ============================ */
		function apply(ctx) {
			var softGet = function (name) {
				if (ctx === null || ctx === void 0 || typeof ctx.get !== 'function') return void 0;
				var value = null;
				try { value = ctx.get(name); } catch (err) { return void 0; }
				return value === null ? void 0 : value;
			};

			function backToConversation() {
				var layout = softGet('layout');
				if (layout !== void 0 && layout !== null && typeof layout.selectPanel === 'function') {
					layout.selectPanel(null);
					return true;
				}
				return false;
			}

			injectCss();

			var locale = null;
			try { locale = ctx.get('locale'); } catch (err) { locale = null; }

			if (locale !== null && locale !== undefined && typeof locale.register === 'function') {
				try {
					ctx.effect(function () {
						var dispose = locale.register(NAMESPACE, { zh: ZH, en: EN });
						return function () { if (typeof dispose === 'function') dispose(); };
					}, 'dsh-epc-workbench: locale copy');
					if (typeof locale.bind === 'function') T_NOW = locale.bind(NAMESPACE);
					else T_NOW = function (key) { return (EN[key] != null ? EN[key] : key); };
				} catch (err) {
					console.error('[epc-workbench] locale registration failed', err);
					T_NOW = function (key) { return (EN[key] != null ? EN[key] : key); };
				}
			} else {
				T_NOW = function (key) { return (EN[key] != null ? EN[key] : key); };
			}

			var Page = function (props) {
				return h(Workbench, Object.assign({}, props, { ctx: ctx }));
			};

			function registerRow() {
				var out = [];
				try {
					out.push(ctx.slots.inject('sidebar.panellist', function () {
						return ctx.slots.register({
							name: 'sidebar.panellist',
							id: PANEL_ID,
							order: 4,
							label: function () { return t('nav.panel'); },
							locale: NAMESPACE
						}, PanelIcon);
					}));
				} catch (err) {
					console.error('[epc-workbench] sidebar row failed to register', err);
				}
				return out;
			}

			function registerPage() {
				try {
					return ctx.slots.inject('main', function () {
						return ctx.slots.register({
							name: 'main',
							key: PANEL_ID,
							locale: NAMESPACE,
							inject: function () {
								return { t: t, surface: 'page', backToConversation: backToConversation };
							}
						}, Page);
					});
				} catch (err) {
					console.error('[epc-workbench] main page failed to register', err);
					return void 0;
				}
			}

			var disposers = [];
			var rowDisposers = registerRow();
			var pageDisposer = registerPage();
			if (pageDisposer !== void 0) disposers.push(pageDisposer);
			disposers = disposers.concat(rowDisposers);

			ctx.effect(function () {
				return function () {
					disposers.forEach(function (dispose) {
						try { if (typeof dispose === 'function') dispose(); } catch (err) { /* ignore */ }
					});
				};
			}, 'dsh-epc-workbench: slots');
		}
