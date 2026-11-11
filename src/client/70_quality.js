		/* ============================ quality & defects ============================ */
		function ViewQuality(props) {
			var data = props.data;
			var defects = data.defects;
			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : defaultScope(data);
			var [query, setQuery] = useState('');
			var [grade, setGrade] = useState('all');
			var [disc, setDisc] = useState('all');
			var [overdue, setOverdue] = useState(false);
			var [limit, setLimit] = useState(150);

			// Raw defect rows live at the top level of the dataset, not under defects.
			var all = defects.defectRows || props.data.defectRows || [];
			var rows = useMemo(function () {
				var q = query.trim().toLowerCase();
				return all.filter(function (d) {
					if (overdue && !(isNum(d.days) && d.days < 0)) return false;
					if (grade !== 'all' && String(d.cat || '—') !== grade) return false;
					if (disc !== 'all' && String(d.disc || '—') !== disc) return false;
					if (q !== '' && (String(d.ref) + ' ' + String(d.desc) + ' ' + String(d.loc)).toLowerCase().indexOf(q) < 0) return false;
					return true;
				});
			}, [all, query, grade, disc, overdue]);

			var gradeEntries = toEntries(defects.byGrade).sort(function (a, b) { return b[1] - a[1]; });
			var gradeMax = gradeEntries.length ? gradeEntries[0][1] : 1;
			var discEntries = toEntries(defects.byDiscipline).sort(function (a, b) { return b[1] - a[1]; });
			// byLocation arrives as a { location: count } map, not a list.
			var locEntries = toEntries(defects.byLocation).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
			var locTotal = sumBy(toEntries(defects.byLocation), 1);

			var kpis = [
				{ label: t('ql.th.status'), value: grouped(defects.openCount), unit: null, sub: t('sub.logged', { n: grouped(defects.total) }) },
				{ label: t('ov.kpi.overdue'), value: grouped(defects.overdueCount), unit: null, sub: t('sub.ofopen', { p: pct(defects.overdueCount, defects.openCount) }) },
				{ label: t('ql.grade', { g: 'A' }), value: grouped((defects.byGrade || {}).A || 0), unit: null, sub: t('ql.sub.grade', { g: 'A' }) },
				{ label: t('ql.byloc'), value: grouped(locTotal), unit: null, sub: t('ql.sub.locs', { n: locEntries.length, m: toEntries(defects.byLocation).length }) }
			];

			return h('div', { className: 'epc-wrap' },
				h(PageHead, {
					title: t('ql.title'),
					sub: t('ql.sub', { total: grouped(defects.total), open: grouped(defects.openCount) })
				}),

				h(ContractBar, { data: data, scope: scope, onScope: props.onScope }),

				h(KpiRow, { items: kpis }),

				h('div', { className: 'epc-grid epc-g3' },
					h(Card, { title: t('ql.bygrade') },
						h('div', { className: 'epc-lbars' }, gradeEntries.map(function (e, i) {
							return h(ListBar, {
								key: 'g' + i,
								label: e[0] === '—' ? t('ql.ungraded') : t('ql.grade', { g: e[0] }),
								value: e[1],
								max: gradeMax,
								color: e[0] === 'A' ? 'var(--epc-crit)' : e[0] === 'B' ? 'var(--epc-warn)' : 'var(--epc-accent)'
							});
						}))),
					h(Card, { title: t('ql.byprio') },
						h('div', { className: 'epc-lbars' }, toEntries(defects.byPriority).sort(function (a, b) { return b[1] - a[1]; }).map(function (e, i) {
							return h(ListBar, {
								key: 'p' + i,
								label: e[0] === '—' ? t('ql.unset') : e[0],
								value: e[1],
								max: toEntries(defects.byPriority).sort(function (a, b) { return b[1] - a[1]; })[0][1],
								color: e[0] === 'High' ? 'var(--epc-crit)' : 'var(--epc-accent)'
							});
						}))),
					h(Card, { title: t('ql.byloc') },
						h('div', { className: 'epc-lbars' }, locEntries.map(function (e, i) {
							return h(ListBar, { key: 'l' + i, label: e[0], value: e[1], max: locEntries[0][1], color: 'var(--epc-warn)' });
						})))),

				h('div', { className: 'epc-card' },
					h('div', { className: 'epc-filters' },
						h('input', {
							className: 'epc-input',
							style: { minWidth: '260px' },
							placeholder: t('lc.search'),
							value: query,
							onChange: function (e) { setQuery(e.target.value); setLimit(150); }
						}),
						h('select', { className: 'epc-select', value: disc, onChange: function (e) { setDisc(e.target.value); } },
							h('option', { value: 'all' }, t('action.all') + ' — ' + t('ql.th.disc')),
							discEntries.map(function (e) {
								return h('option', { key: e[0], value: e[0] }, (t('ql.disc.' + String(e[0]).toLowerCase()) || e[0]) + ' (' + e[1] + ')');
							})),
						h('select', { className: 'epc-select', value: grade, onChange: function (e) { setGrade(e.target.value); } },
							h('option', { value: 'all' }, t('action.all') + ' — ' + t('ql.th.cat')),
							gradeEntries.map(function (e) {
								return h('option', { key: e[0], value: e[0] }, (e[0] === '—' ? t('ql.ungraded') : t('ql.grade', { g: e[0] })) + ' (' + e[1] + ')');
							})),
						h('button', {
							className: 'epc-chip' + (overdue ? ' on' : ''),
							onClick: function () { setOverdue(!overdue); setLimit(150); }
						}, t('ql.overdue') + ' ' + defects.overdueCount),
						h('span', { className: 'epc-filter-count' }, t('lc.showing', { n: Math.min(limit, rows.length), total: rows.length }))),

					rows.length === 0 ? h(Empty) : h('table', { className: 'epc-tbl' },
						h('thead', null, h('tr', null,
							h('th', null, t('ql.th.ref')),
							h('th', null, t('ql.th.disc')),
							h('th', null, t('ql.th.loc')),
							h('th', null, t('ql.th.desc')),
							h('th', null, t('ql.th.cat')),
							h('th', null, t('ql.th.target')),
							h('th', null, t('ql.th.status')),
							h('th', { className: 'r' }, t('ql.th.days')),
							h('th', null, t('ql.th.prio')))),
						h('tbody', null, rows.slice(0, limit).map(function (d, i) {
							var late = isNum(d.days) && d.days < 0;
							return h('tr', { key: 'd' + i },
								h('td', { className: 'mono' },
									h('span', { style: { opacity: 0.55, marginRight: '6px' } }, d.no ? '#' + d.no : ''),
									d.ref),
								h('td', null, h('span', { className: 'epc-pill' }, d.disc || '—')),
								h('td', { className: 'dim' }, truncate(d.loc, 22)),
								h('td', null, h('div', { className: 'epc-clip' }, d.desc)),
								h('td', null, h(Pill, {
									tone: d.cat === 'A' ? 'crit' : d.cat === 'B' ? 'warn' : '',
									dot: false
								}, d.cat || '—')),
								h('td', { className: 'mono dim' }, shortDate(d.target)),
								h('td', null, h(Pill, { tone: d.status === 'Closed' ? 'good' : 'warn', dot: false }, d.status || '—')),
								h('td', {
									className: 'r mono',
									style: { color: late ? 'var(--epc-crit)' : 'var(--epc-muted)', fontWeight: late ? 650 : 400 }
								}, isNum(d.days) ? String(d.days) : '—'),
								h('td', { className: 'dim' }, d.prio || '—'));
						}))),

					rows.length > limit
						? h('div', { style: { padding: '10px 14px', borderTop: '1px solid var(--epc-line)' } },
							h('button', { className: 'epc-btn', onClick: function () { setLimit(limit + 200); } }, t('lc.more')))
						: null,

					h('div', { className: 'epc-note' }, t('ql.note', { n: all.length, total: defects.total }))));
		}

		/* ============================ documents ============================ */
		function bytes(size) {
			if (!isNum(size) || size <= 0) return '—';
			if (size >= 1048576) return (size / 1048576).toFixed(1) + ' MB';
			if (size >= 1024) return (size / 1024).toFixed(0) + ' KB';
			return size + ' B';
		}

		function ViewDocuments(props) {
			var data = props.data;
			var docs = data.docs;
			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : defaultScope(data);

			var issued = (docs.toc || []).filter(function (d) { return d.state === 'issued'; });
			var draft = (docs.toc || []).filter(function (d) { return d.state !== 'issued'; });
			var mc = data.mainContract || {};
			/* The employer's signed certificates arrived as scans and carry no text
			   layer, so they are registered by reference and size only — the figure
			   that matters (the certified amount) is taken from the workbook series. */
			var scans = mc.scans || [];
			var amended = scans.filter(function (s) { return s.amended; }).length;
			var docRet = lastRetention(data, subScopeIds(data)[0]);

			var kpis = [
				{ label: t('dc.contracts'), value: String(docs.contracts.length), unit: null, sub: t('dc.sub.contracts') },
				{ label: t('dc.toc'), value: String(docs.toc.length), unit: null, sub: t('dc.sub.toc', { i: issued.length, d: draft.length }) },
				{ label: t('dc.scans'), value: String(scans.length), unit: null, sub: t('dc.sub.scans', { a: amended }) },
				{ label: t('dc.media'), value: grouped(docs.media.photos + docs.media.videos + docs.media.pdfLetters), unit: null, sub: t('dc.sub.media') }
			];

			return h('div', { className: 'epc-wrap' },
				h(PageHead, { title: t('dc.title'), sub: t('dc.sub') }),

				h(ContractBar, { data: data, scope: scope, onScope: props.onScope }),

				h(KpiRow, { items: kpis }),

				scans.length > 0
					? h(Card, { title: t('dc.scans'), note: t('dc.scans.note', { n: scans.length }), flush: true },
						h('table', { className: 'epc-tbl' },
							h('thead', null, h('tr', null,
								h('th', null, t('dc.th.ref')),
								h('th', null, t('dc.th.cert')),
								h('th', null, t('dc.th.issuer')),
								h('th', null, t('th.state')),
								h('th', { className: 'r' }, t('th.size')))),
							h('tbody', null, scans.map(function (s, i) {
								return h('tr', { key: 's' + i },
									h('td', { className: 'mono' },
										s.ref || '—',
										s.copies > 1 ? h('span', { className: 'epc-pill', style: { marginLeft: '6px' } }, '×' + s.copies) : null),
									h('td', { className: 'mono dim' }, s.ordinal != null ? t('dc.cert.no', { n: s.ordinal }) : (s.enclosure ? t('dc.kind.enclosure') : '—')),
									h('td', { className: 'mono dim' }, s.issuer),
									h('td', null,
										s.enclosure
											? h(Pill, { tone: '', dot: false }, t('dc.kind.enclosure'))
											: h(Pill, { tone: s.amended ? 'warn' : 'good', dot: false }, s.amended ? t('dc.kind.amended') : t('dc.kind.signed'))),
									h('td', { className: 'r mono dim' }, bytes(s.size)));
							}))))
					: null,

				h('div', { className: 'epc-grid epc-g2' },
					h(Card, {
						title: t('dc.contracts'),
						note: String(docs.contracts.length) + ' ' + t('dc.files'),
						flush: true
					}, h('table', { className: 'epc-tbl' },
						h('thead', null, h('tr', null,
							h('th', null, t('th.name')),
							h('th', null, t('dc.type')),
							h('th', { className: 'r' }, t('th.size')))),
						h('tbody', null, docs.contracts.map(function (d, i) {
							return h('tr', { key: 'c' + i },
								h('td', null, h('div', { className: 'epc-clip' }, d.name)),
								h('td', { className: 'mono dim' }, String(d.ext || '').toUpperCase()),
								h('td', { className: 'r mono dim' }, bytes(d.size)));
						})))),

					h(Card, { title: t('dc.toc'), note: issued.length + ' / ' + docs.toc.length, flush: true },
						h('table', { className: 'epc-tbl' },
							h('thead', null, h('tr', null,
								h('th', null, t('th.name')),
								h('th', null, t('th.state')),
								h('th', { className: 'r' }, t('th.size')))),
							h('tbody', null, docs.toc.map(function (d, i) {
								return h('tr', { key: 't' + i },
									h('td', null, h('div', { className: 'epc-clip' }, d.name)),
									h('td', null, h(Pill, { tone: d.state === 'issued' ? 'good' : 'warn', dot: false },
										d.state === 'issued' ? t('dc.toc.issued') : t('dc.toc.draft'))),
									h('td', { className: 'r mono dim' }, bytes(d.size)));
							}))))),

				h('div', { className: 'epc-grid epc-g23' },
					h(Card, { title: t('dc.materials'), note: String(docs.materials.length), flush: true },
						h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' } },
							docs.materials.map(function (m) {
								return h('div', {
									key: m.name,
									style: {
										padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '3px',
										borderRight: '1px solid var(--epc-line)', borderBottom: '1px solid var(--epc-line)'
									}
								},
									h('span', { className: 'epc-mono', style: { fontSize: '12px', fontWeight: 600 } }, m.name),
									h('span', { style: { fontSize: '11px', color: 'var(--epc-dim)' } },
										m.files === 1 ? t('dc.file.one') : t('dc.files.n', { n: m.files })));
							}))),

					h(Card, { title: t('dc.media') },
						h('div', { className: 'epc-lbars' },
							h(ListBar, { label: t('dc.photos'), value: docs.media.photos, max: docs.media.photos, display: grouped(docs.media.photos) }),
							h(ListBar, { label: t('dc.pdfletters'), value: docs.media.pdfLetters, max: docs.media.photos, display: grouped(docs.media.pdfLetters), color: 'var(--epc-warn)' }),
							h(ListBar, { label: t('dc.videos'), value: docs.media.videos, max: docs.media.photos, display: grouped(docs.media.videos), color: 'var(--epc-good)' })),
						h('div', { className: 'epc-splitline', style: { marginTop: '14px' } }, t('dc.retention')),
						h('dl', { className: 'epc-kv' },
							h('dt', null, t('co.kpi.retention')), h('dd', { className: 'epc-mono' }, grouped(docRet ? docRet.retCum : null, 2)),
							h('dt', null, t('co.kpi.advance')), h('dd', { className: 'epc-mono' }, grouped(docRet ? docRet.advCum : null, 2))))),

				h('div', { className: 'epc-note' }, t('src.docs')));
		}
