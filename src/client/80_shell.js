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

		/* One page per subject folder. The project is organised as ten folders and
		   each of them is a place a reader goes looking for something: the drawings,
		   the photographs, the evidence that a takeover certificate was signed. The
		   eight sections above read the records inside those folders; these pages
		   show the folders themselves, including the two — photographs and videos —
		   that carry no structured record at all. */
		var FOLDER_VIEWS = [
			{ id: 'f_contracts', folder: 'contracts', cluster: 'folders', icon: 'contracts' },
			{ id: 'f_defects', folder: 'defects', cluster: 'folders', icon: 'defects' },
			{ id: 'f_drawings', folder: 'drawings', cluster: 'folders', icon: 'drawings' },
			{ id: 'f_letters', folder: 'letters', cluster: 'folders', icon: 'letters' },
			{ id: 'f_materials', folder: 'materials', cluster: 'folders', icon: 'materials' },
			{ id: 'f_meetings', folder: 'meetings', cluster: 'folders', icon: 'meetings' },
			{ id: 'f_payments', folder: 'payments', cluster: 'folders', icon: 'payments' },
			{ id: 'f_photos', folder: 'photos', cluster: 'folders', icon: 'photos' },
			{ id: 'f_taking_overs', folder: 'taking_overs', cluster: 'folders', icon: 'taking_overs' },
			{ id: 'f_videos', folder: 'videos', cluster: 'folders', icon: 'videos' }
		];

		var NAV_VIEWS = VIEWS.concat(FOLDER_VIEWS);


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

		function modelName(value) {
			/* A route reads 'provider/model', and the provider is the part a reader
			   already knows: the chip has to say which model, not which vendor. */
			var text = String(value || '');
			var cut = text.lastIndexOf('/');
			return cut >= 0 && cut < text.length - 1 ? text.slice(cut + 1) : text;
		}

		function reasonText(error) {
			/* A failure has a cause and the cause has words. Printing only 'could not
			   read that folder' made every failure look like the same failure, so a
			   reader could not tell a folder holding no records from one still being
			   written to. The first line names it; the rest stays in the title. */
			var text = String(error || '').split('\n')[0].trim();
			if (!text) return t('src.failed');
			return text.length > 120 ? text.slice(0, 117) + '…' : text;
		}

		function SourceBar(props) {
			var active = props.active;
			var busy = props.busy;
			var error = props.error;
			var notes = props.notes || [];
			var found = props.found || [];
			var demo = (active && active.demo) || [];
			var blank = (active && active.blank) || [];
			var isFolder = active && active.source === 'folder';
			return h('div', { className: 'epc-src' + (isFolder ? ' on' : '') },
				h('span', { className: 'epc-src-k' }, t('src.title')),
				h('span', { className: 'epc-src-v' },
					h('span', { className: 'epc-src-name' }, sourceName(active)),
					isFolder && active.builtAt
						? h('span', { className: 'epc-src-when' }, t('src.read', { date: shortDate(String(active.builtAt).slice(0, 10)) }))
						: h('span', { className: 'epc-src-when' }, t('src.bundled.note'))),
				error !== null && error !== void 0
					/* The reason, not a category: 'could not read that folder' was the
					   same sentence for a timeout, a locked workbook and an empty
					   directory, and none of them was actionable. The full text stays
					   in the title; what is printed is the part that names the cause. */
					? h('span', { className: 'epc-src-err', title: String(error) }, reasonText(error))
					: null,
				busy
					? h('span', { className: 'epc-src-busy' }, h('i', { className: 'epc-dot' }), t('src.reading'))
					: null,
				blank.length > 0
					/* Empty because the folder does not hold the records, not because
					   the project has none. The distinction is the whole point of a
					   blank section: it says what to add, not what is zero. */
					? h('button', {
						className: 'epc-src-blank' + (props.notesOpen ? ' on' : ''),
						onClick: props.onToggleNotes,
						title: t('src.blank.hint')
					}, t('src.blank', { n: blank.length }))
					: null,
				demo.length > 0
					/* The page is a real read of the folder with the demo standing in
					   for the sections it does not hold. Saying so beside the folder
					   name is the difference between 'this project has no defects' and
					   'this folder has no defect register in it'. */
					? h('button', {
						className: 'epc-src-demo' + (props.notesOpen ? ' on' : ''),
						onClick: props.onToggleNotes,
						title: t('src.demo.hint', { list: demo.map(function (k) { return t('src.section.' + k); }).join(' · ') })
					}, t('src.demo', { n: demo.length }))
					: null,
				notes.length > 0
					/* A folder whose records differ from the ones this workbench was
					   first pointed at still renders; the count says how much of the
					   page could not be filled, and the list says which parts. */
					? h('button', {
						className: 'epc-src-notes' + (props.notesOpen ? ' on' : ''),
						onClick: props.onToggleNotes,
						title: t('src.notes.hint')
					}, t('src.notes', { n: notes.length }))
					: (isFolder && found.length > 0
						/* Nothing missing is worth saying too: otherwise a folder read
						   completely looks the same as one nobody has opened. */
						? h('button', {
							className: 'epc-src-notes ok' + (props.notesOpen ? ' on' : ''),
							onClick: props.onToggleNotes,
							title: t('src.found.hint')
						}, t('src.found', { n: found.length }))
						: null),
				/* Which model described the layout, when one did. The page's shape
				   is that model's reading of the folder, and a reader who disagrees
				   with it needs to know who to blame. */
				isFolder && active.model
					? h('span', { className: 'epc-src-model', title: t('src.model.hint', { model: active.model }) }, t('src.model', { model: modelName(active.model) }))
					: null,
				h('span', { className: 'grow' }),
				busy ? null : h('button', {
					className: 'epc-btn',
					onClick: props.onPick,
					title: t('src.pick.hint')
				}, t('src.pick')),
				busy ? null : h('button', {
					className: 'epc-btn',
					onClick: props.onAnalyze,
					title: t('src.analyze.hint')
				}, t('src.analyze')),
				!busy && isFolder ? h('button', {
					className: 'epc-btn',
					onClick: props.onReset,
					title: t('src.reset.hint')
				}, t('src.reset')) : null);
		}

		/* The model picker.
		   Reading a folder with a model asks which model before it starts: the
		   installation usually has several, they differ in cost and in how much
		   they can read in one call, and the choice belongs to the reader rather
		   than to whatever the session happens to be using. The list comes from the
		   host, because the browser cannot see the model catalogue. A picker that
		   cannot load still works: it offers the session's own model and says so. */

		/* A model badge is not always a string. The host returns the plain ones as
		   text and the richer ones as {text, tone} — 'Pro Only' in green, 'Free now'
		   in amber — and React throws 'Objects are not valid as a React child' on the
		   object form. That exception unmounts the whole tree, which is a blank page
		   rather than a broken badge, so the badge is reduced to its text here and its
		   tone becomes a class. */
		function badgeText(badge) {
			if (badge === null || badge === undefined) return '';
			if (typeof badge === 'string') return badge.trim();
			if (typeof badge === 'number') return String(badge);
			if (typeof badge === 'object' && typeof badge.text === 'string') return badge.text.trim();
			return '';
		}

		function badgeTone(badge) {
			if (!badge || typeof badge !== 'object') return '';
			var tone = String(badge.tone || '').trim().toLowerCase();
			return tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'neutral' ? tone : '';
		}

		function ModelPicker(props) {
			var groups = props.providers || [];
			var [chosen, setChosen] = useState(props.current || null);
			if (props.error) {
				return h('div', { className: 'epc-pal-mask', onClick: props.onCancel },
					h('div', { className: 'epc-pal epc-models', onClick: function (e) { e.stopPropagation(); } },
						h('div', { className: 'epc-pal-in' }, h('strong', null, t('src.models.title'))),
						h('div', { className: 'epc-models-empty' }, props.error),
						h('div', { className: 'epc-pal-f' },
							h('span', { className: 'grow' }),
							h('button', { className: 'epc-btn', onClick: props.onCancel }, t('src.models.cancel')))));
			}
			var flat = [];
			groups.forEach(function (g) {
				(g.models || []).forEach(function (m) { flat.push({ provider: g.id, model: m.id, name: m.name, badge: m.badge, group: g.name }); });
			});
			return h('div', { className: 'epc-pal-mask', onClick: props.onCancel },
				h('div', { className: 'epc-pal epc-models', onClick: function (e) { e.stopPropagation(); } },
					h('div', { className: 'epc-pal-in' },
						h('strong', null, t('src.models.title')),
						h('span', { className: 'epc-dim' }, t('src.models.note'))),
					h('div', { className: 'epc-pal-list' },
						groups.map(function (g) {
							return h('div', { key: g.id, className: 'epc-models-group' },
								h('div', { className: 'epc-models-gk' }, g.name || g.id),
								(g.models || []).map(function (m) {
									var on = chosen && chosen.provider === g.id && chosen.model === m.id;
									return h('button', {
										key: g.id + '/' + m.id,
										className: 'epc-models-row' + (on ? ' on' : ''),
										onClick: function () { setChosen({ provider: g.id, model: m.id }); }
									},
										h('span', { className: 'epc-models-n' }, m.name || m.id),
										badgeText(m.badge) ? h('span', { className: 'epc-models-b' + (badgeTone(m.badge) ? ' t-' + badgeTone(m.badge) : '') }, badgeText(m.badge)) : null,
										m.description ? h('span', { className: 'epc-models-d' }, m.description) : null);
								}));
						}),
						flat.length === 0 ? h('div', { className: 'epc-models-empty' }, t('src.models.none')) : null),
					h('div', { className: 'epc-pal-f' },
						h('span', { className: 'epc-dim' }, chosen ? t('src.models.picked', { model: chosen.model }) : t('src.models.pick')),
						h('span', { className: 'grow' }),
						h('button', { className: 'epc-btn', onClick: props.onCancel }, t('src.models.cancel')),
						h('button', {
							className: 'epc-btn on',
							disabled: !chosen,
							onClick: function () { if (chosen) props.onStart(chosen); }
						}, t('src.models.start')))));
		}

		function NoteList(props) {
			var notes = props.notes || [];
			var found = props.found || [];
			var demo = props.demo || [];
			var blank = props.blank || [];
			if (notes.length === 0 && found.length === 0 && demo.length === 0 && blank.length === 0) return null;
			return h('div', { className: 'epc-notes' },
				notes.length > 0
					? h('div', { className: 'epc-notes-k' }, t('src.notes.title', { n: notes.length }))
					: null,
				notes.length > 0
					? h('ul', { className: 'epc-notes-l' }, notes.map(function (n, i) {
						return h('li', { key: 'n' + i }, n);
					}))
					: null,
				found.length > 0
					/* What the reader did recognise. Worth printing: a folder read
					   completely shows the same list, so 'read 4 of 4' is a statement
					   about the project, not a log line. */
					? h('div', { className: 'epc-notes-k' }, t('src.found.title', { n: found.length }))
					: null,
				found.length > 0
					? h('ul', { className: 'epc-notes-l epc-notes-ok' }, found.map(function (n, i) {
						return h('li', { key: 'f' + i }, n);
					}))
					: null,
				demo.length > 0
					/* Which parts of the page are the demo standing in. Printed last,
					   so the reader first sees what was actually read out of their
					   own folder and only then what was not. */
					? h('div', { className: 'epc-notes-k' }, t('src.demo.title', { n: demo.length }))
					: null,
				demo.length > 0
					? h('ul', { className: 'epc-notes-l epc-notes-demo' }, demo.map(function (n, i) {
						return h('li', { key: 'd' + i }, n);
					}))
					: null,
				blank.length > 0
					? h('div', { className: 'epc-notes-k' }, t('src.blank.title', { n: blank.length }))
					: null,
				blank.length > 0
					? h('ul', { className: 'epc-notes-l epc-notes-blank' }, blank.map(function (n, i) {
						return h('li', { key: 'b' + i }, n);
					}))
					: null,
				blank.length > 0
					/* What the page is waiting for. A list of missing sections is a
					   diagnosis; this is the instruction beside it. */
					? h('div', { className: 'epc-notes-hint' }, t('src.blank.add'))
					: null,
				props.hint
					/* The reader recognised nothing at all. That is not a dead end
					   any more, but the way out is a button in the strip, and a
					   reader looking at this list is exactly the one who needs
					   pointing at it. */
					? h('div', { className: 'epc-notes-hint' }, props.hint)
					: null);
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
			var [notesOpen, setNotesOpen] = useState(false);
			/* The picker is open while the reader is choosing which model reads the
			   folder, and the catalogue it shows is fetched when it opens. */
			var [picker, setPicker] = useState(null);

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
			function chooseFolder(url, route) {
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
					var body = { folder: folder };
					/* The model the reader picked, when they picked one. Sent with the
					   request rather than stored here: the host owns the build, and a
					   second tab picking a different model must not fight over it. */
					if (route) body.route = route;
					return postJson(url, body).then(function () {
						return waitForBuild(folder, 0);
					});
				}).catch(function (err) {
					setReading(false);
					setSourceError(String(err && err.message ? err.message : err));
				});
			}

			function pickFolder() {
				chooseFolder(FOLDER_URL);
			}

			/* The reader could not make sense of the folder, or the reader's answer
			   was thin and the user wants the model's instead. Same wait, different
			   route: the host does the describing and asking. */
			function analyzeFolder() {
				/* Ask which model first. The catalogue is fetched once, when the
				   picker opens, because it is the host's to know and can change
				   between one read and the next. */
				setPicker({ loading: true, providers: [], current: null, error: null });
				fetch(MODELS_URL, { credentials: 'same-origin' })
					.then(function (res) {
						if (!res.ok) throw new Error('the model catalogue could not be read (' + res.status + ')');
						return res.json();
					})
					.then(function (json) {
						var providers = (json && json.providers) || [];
						setPicker({
							loading: false,
							providers: providers,
							current: (json && json.current) || null,
							error: providers.length === 0 ? t('src.models.none') : null
						});
					})
					.catch(function (err) {
						setPicker({ loading: false, providers: [], current: null, error: String(err && err.message ? err.message : err) });
					});
			}

			function startAnalyze(route) {
				setPicker(null);
				chooseFolder(ANALYZE_URL, route);
			}

			function waitForBuild(folder, tries) {
				return readState().then(function (json) {
					var b = json && json.build ? json.build : null;
					if (b && b.progress) {
						var line = String(b.progress).split(/\r?\n/).filter(function (s) { return s.trim() !== ''; });
						if (line.length > 0) setReadProgress(line[line.length - 1].trim().slice(0, 120));
					}
					if (b && b.phase === 'model') setReadProgress(t('src.analyze.wait'));
					if (b && b.status === 'running' && tries < 900) {
						return new Promise(function (resolve) { setTimeout(resolve, 1000); })
							.then(function () { return waitForBuild(folder, tries + 1); });
					}
					setReading(false);
					if (b && b.status === 'running') {
						/* Still working after fifteen minutes. Say which stage it is in
						   rather than showing a generic failure: the read is not lost,
						   and pressing the button again would start a second one. */
						setSourceError(t('src.timeout', { phase: b.phase || 'reading' }));
						return null;
					}
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
			/* Everything the reader could not open, from both halves: the host keeps
			   what discovery could not recognise, the payload keeps what the
			   extractor could not read. A page that shows four empty cards and no
			   explanation reads like a broken plugin. */
			var readNotes = useMemo(function () {
				var out = [];
				var seen = {};
				var push = function (list) {
					(list || []).forEach(function (n) {
						var text = String(n || '').trim();
						if (text && !seen[text]) { seen[text] = true; out.push(text); }
					});
				};
				if (source && source.active) push(source.active.notes);
				if (data) push(data.warnings);
				return out;
			}, [source, data]);
			/* What discovery recognised. Kept apart from readNotes because a folder
			   read completely must say so: four 'found' lines are four successes, and
			   showing them under a 'not found' heading would report the opposite. */
			var readFound = useMemo(function () {
				var out = [];
				var seen = {};
				((source && source.active && source.active.found) || []).forEach(function (n) {
					var text = String(n || '').trim();
					if (text && !seen[text]) { seen[text] = true; out.push(text); }
				});
				return out;
			}, [source]);
			/* A folder the reader could not read at all, which is the case the
			   strip's second button exists for. The hint is printed inside the
			   gap list, because that is where a reader ends up when the page
			   looks empty and nothing has explained why. */
			var readHint = useMemo(function () {
				var isFolder = source && source.active && source.active.source === 'folder';
				if (!isFolder || readFound.length > 0) return null;
				return t('src.notes.empty.hint');
			}, [source, readFound]);
			/* The sections standing in from the demo, named in the gap list. The
			   chip in the strip says how many; this says which, because '4 sections
			   from the demo' is useless without knowing whether payments is one of
			   them. */
			var readBlank = useMemo(function () {
				var list = (source && source.active && source.active.blank) || [];
				return list.map(function (k) { return t('src.section.' + k); });
			}, [source]);

			var readDemo = useMemo(function () {
				return ((source && source.active && source.active.demo) || []).map(function (k) {
					return t('src.section.' + k);
				});
			}, [source]);
			/* The accessors, not the raw sections: a folder read that held no
			   letters produces no letters key at all, and a badge is not worth a
			   throw that unmounts the whole rail. */
			var navLetters = lettersOf(data);
			var navMeetings = meetingsOf(data);
			var navDefects = defectsOf(data);
			var navDocs = docsOf(data);
			var counts = data ? {
				correspondence: navLetters.total,
				meetings: navMeetings.total,
				quality: navDefects.openCount,
				documents: navDocs.contracts.length + navDocs.toc.length + navDocs.materials.length
			} : {};
			/* A folder page is named after the folder, so its badge is the folder's
			   own file count — the one number a reader wants before opening it. A
			   folder that is not there carries no badge rather than a zero. */
			if (data && data.folders) {
				FOLDER_VIEWS.forEach(function (v) {
					var n = folderCount(data, v.folder);
					if (n > 0) counts[v.id] = n;
				});
			}

			var clusters = useMemo(function () {
				var order = ['project', 'delivery', 'records', 'folders'];
				var map = {};
				order.forEach(function (c) { map[c] = []; });
				NAV_VIEWS.forEach(function (v) { (map[v.cluster] || (map[v.cluster] = [])).push(v); });
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
				else if (view.indexOf('f_') === 0) body = h(ViewFolder, { data: data, folderKey: view.slice(2) });
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
										!mini && count !== undefined && count > 0
											? h('span', {
												className: 'epc-badge' + (v.cluster === 'folders' ? ' quiet' : '')
											}, count > 9999 ? '9k+' : String(count))
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
								notes: readNotes,
								found: readFound,
								notesOpen: notesOpen,
								onToggleNotes: function () { setNotesOpen(function (v) { return !v; }); },
								onPick: pickFolder,
								onAnalyze: analyzeFolder,
								onReset: resetSource
							}),
							notesOpen ? h(NoteList, { notes: readNotes, found: readFound, demo: readDemo, blank: readBlank, hint: readHint }) : null),
						h('div', { className: 'epc-scroll' }, body))),

				h('div', { className: 'epc-status' },
					h('span', { className: 'epc-live' }, h('i', { className: 'epc-dot' }), t('status.live')),
					data ? h('span', null, t('status.records', { n: grouped(recordCount(data)) })) : null,
					data ? h('span', null, t('status.data', { date: isoDate(data.generated) })) : null,
					h('span', { className: 'grow' }),
					h('div', { className: 'epc-status-r' },
						scopeNo !== null ? h('em', null, scopeNo) : null,
						data ? h('em', null, flowLabel) : null)),

				palette ? h(CommandPalette, { onClose: function () { setPalette(false); }, onSelect: onSelectResult }) : null,
				/* The picker sits above the page rather than inside the strip: a strip
				   button that opened a list in place would push the page down while the
				   reader is deciding, and this is a decision, not a progress step. */
				picker ? h(ModelPicker, {
					providers: picker.providers,
					current: picker.current,
					error: picker.error,
					onStart: startAnalyze,
					onCancel: function () { setPicker(null); }
				}) : null);
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

			/* A render that throws unmounts the whole tree, and the host has no error
			   boundary of its own: the reader sees the sidebar beside a white panel
			   with nothing to act on. This is the boundary for that. It prints the
			   message the browser already logged, so a report of "the page went
			   blank" carries the line that broke. */
			function boundaryClass() {
				if (!React.Component || !React.Component.prototype) return null;
				return class EpcBoundary extends React.Component {
					constructor(props) {
						super(props);
						this.state = { error: null };
					}

					static getDerivedStateFromError(error) {
						return { error: error };
					}

					componentDidCatch(error, info) {
						console.error('[epc-workbench] the page threw while rendering', error, info);
					}

					render() {
						var error = this.state.error;
						if (!error) return this.props.children;
						return h('div', { className: 'epc-err' },
							t('app.crash'),
							h('br'),
							h('code', null, String(error && error.message ? error.message : error)),
							h('div', { className: 'epc-notes-hint' }, t('app.crash.hint')));
					}
				};
			}

			var Boundary = boundaryClass();

			var Page = function (props) {
				var page = h(Workbench, Object.assign({}, props, { ctx: ctx }));
				/* Without a class-capable React there is no boundary to install, so
				   the page is rendered bare rather than refusing to render. */
				return Boundary === null ? page : h(Boundary, null, page);
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
