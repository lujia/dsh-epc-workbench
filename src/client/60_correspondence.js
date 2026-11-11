		/* ============================ shared index hook ============================ */
		var INDEX_STATE = { data: null, error: null, waiting: [] };

		function useIndex() {
			var [state, setState] = useState(function () {
				return INDEX_STATE.data !== null ? { data: INDEX_STATE.data, error: null } : { data: null, error: null };
			});

			useEffect(function () {
				var alive = true;
				if (INDEX_STATE.data !== null) {
					setState({ data: INDEX_STATE.data, error: null });
					return function () { alive = false; };
				}
				loadIndex().then(function (rows) {
					INDEX_STATE.data = rows;
					if (alive) setState({ data: rows, error: null });
				}).catch(function (err) {
					if (alive) setState({ data: null, error: err });
				});
				return function () { alive = false; };
			}, []);

			return state;
		}

		function letterCode(ref) {
			var parts = String(ref || '').split('-');
			if (parts.length < 2) return '—';
			return parts[parts.length - 2];
		}

		/* ============================ correspondence ============================ */
		function ViewCorrespondence(props) {
			var data = props.data;
			var index = useIndex();
			var letters = data.letters;

			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : defaultScope(data);
			/* Correspondence follows the contract rather than the whole register:
			   which series belong to a contract is configuration, and when a
			   reference records its package token the reference decides. */
			var scopeSeries = seriesKeysFor(data, scope);
			var scopeTag = contractTag(data, scope);

			var [series, setSeries] = useState(function () { return props.series || 'all'; });
			var [query, setQuery] = useState('');
			var [limit, setLimit] = useState(120);
			var [code, setCode] = useState('all');

			var rows = useMemo(function () {
				var all = (index.data || []).filter(function (r) { return r[0] === 'L'; });
				var q = query.trim().toLowerCase();
				return all.filter(function (r) {
					if (scopeSeries.indexOf(r[4]) < 0) return false;
					if (scopeTag !== null && String(r[1]).indexOf(scopeTag) < 0) return false;
					if (series !== 'all' && r[4] !== series) return false;
					if (code !== 'all' && letterCode(r[1]) !== code) return false;
					if (q !== '' && (String(r[1]).toLowerCase().indexOf(q) < 0 && String(r[3]).toLowerCase().indexOf(q) < 0)) return false;
					return true;
				}).sort(function (a, b) {
					var da = String(a[2] || '');
					var db = String(b[2] || '');
					return da < db ? 1 : da > db ? -1 : 0;
				});
			}, [index.data, scope, series, query, code]);

			/* The code mix and the recurring subjects are recomputed from the
			   selected contract rather than read from the project-wide aggregates,
			   otherwise 'top codes' would keep reporting employer letters while a
			   package is selected. */
			var scopedStats = useMemo(function () {
				var byCode = {};
				var bySubject = {};
				var byMonth = {};
				var bySeries = {};
				var total = 0;
				(index.data || []).forEach(function (r) {
					if (r[0] !== 'L') return;
					if (scopeSeries.indexOf(r[4]) < 0) return;
					if (scopeTag !== null && String(r[1]).indexOf(scopeTag) < 0) return;
					total += 1;
					bySeries[r[4]] = (bySeries[r[4]] || 0) + 1;
					var c = letterCode(r[1]);
					byCode[c] = (byCode[c] || 0) + 1;
					var subj = String(r[3] || '').trim();
					if (subj && subj.toLowerCase().indexOf('no_subject') < 0) bySubject[subj] = (bySubject[subj] || 0) + 1;
					var mk = String(r[2] || '').slice(0, 7);
					if (mk.length === 7) byMonth[mk] = (byMonth[mk] || 0) + 1;
				});
				return { byCode: byCode, bySubject: bySubject, byMonth: byMonth, bySeries: bySeries, total: total };
			}, [index.data, scope]);

			var codeBars = useMemo(function () { return topEntries(scopedStats.byCode, 10); }, [scopedStats]);
			var topBars = useMemo(function () {
				return toEntries(scopedStats.bySubject).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
			}, [scopedStats]);

			var codeOptions = useMemo(function () { return topEntries(scopedStats.byCode, 20); }, [scopedStats]);
			var monthSeries = lastN(sortEntriesAsc(scopedStats.byMonth), 24);
			var topSubjects = topBars.map(function (e) { return { subj: e[0], count: e[1] }; });

			var counts = letters.bySeries;
			var scopeTotal = scopeSeries.reduce(function (acc, key) {
				return acc + (counts[key] ? counts[key].count : 0);
			}, 0);

			var chips = [['all', t('lc.series.all'), scopedStats.total || scopeTotal]].concat(scopeSeries.map(function (key) {
				return [key, seriesLabel(data, key), scopedStats.bySeries[key] || 0];
			}));

			return h('div', { className: 'epc-wrap' },
				h(PageHead, {
					title: t('lc.title'),
					sub: t('lc.sub', { total: grouped(letters.total), dated: grouped(letters.dated) })
				}),

				h(ContractBar, { data: data, scope: scope, onScope: props.onScope }),

				h('div', { className: 'epc-grid epc-g4' }, scopeSeries.map(function (key) {
					var s = counts[key] || { count: 0, first: null, last: null };
					return h(Kpi, {
						key: key,
						label: seriesLabel(data, key),
						value: grouped(scopedStats.bySeries[key] || 0),
						sub: shortDate(s.first) + ' → ' + shortDate(s.last)
					});
				})),

				h('div', { className: 'epc-grid epc-g2' },
					h(Card, { title: t('lc.bycode'), note: t('ui.top', { n: 10 }) },
						h('div', { className: 'epc-lbars' }, codeBars.map(function (e, i) {
							return h(ListBar, { key: 'c' + i, label: e[0], value: e[1], max: codeBars.length ? codeBars[0][1] : 1 });
						}))),
					h(Card, { title: t('lc.bymonth') }, h(BarChart, { data: monthSeries, height: '96px' }))),

				topSubjects.length > 0
					? h(Card, { title: t('lc.topsubj'), note: t('ui.top', { n: topSubjects.length }) },
						h('div', { className: 'epc-lbars' }, topSubjects.map(function (s, i) {
							return h(ListBar, {
								key: 's' + i,
								label: truncate(s.subj, 48),
								value: s.count,
								max: topSubjects[0].count,
								color: 'var(--epc-warn)'
							});
						})))
					: null,

				h('div', { className: 'epc-card' },
					h('div', { className: 'epc-filters' },
						h('input', {
							className: 'epc-input',
							style: { minWidth: '260px' },
							placeholder: t('lc.search'),
							value: query,
							onChange: function (e) { setQuery(e.target.value); setLimit(120); }
						}),
						h('select', {
							className: 'epc-select',
							value: code,
							onChange: function (e) { setCode(e.target.value); setLimit(120); }
						}, [['all', t('action.all')]].concat(codeOptions.map(function (e) { return [e[0], e[0] + ' (' + e[1] + ')']; })).map(function (pair) {
							return h('option', { key: pair[0], value: pair[0] }, pair[1]);
						})),
						h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, chips.map(function (c) {
							return h('button', {
								key: c[0],
								className: 'epc-chip' + (series === c[0] ? ' on' : ''),
								onClick: function () { setSeries(c[0]); setLimit(120); }
							}, c[1] + ' ' + c[2]);
						})),
						h('span', { className: 'epc-filter-count' }, t('lc.showing', { n: Math.min(limit, rows.length), total: rows.length }))),

					index.data === null
						? (index.error ? h('div', { className: 'epc-err' }, t('app.error') + ' ', h('code', null, String(index.error.message || index.error))) : h(Loading))
						: (rows.length === 0 ? h(Empty) : h('table', { className: 'epc-tbl' },
							h('thead', null, h('tr', null,
								h('th', null, t('lc.th.no')),
								h('th', null, t('lc.th.subject')),
								h('th', null, t('lc.th.code')),
								h('th', null, t('lc.th.series')),
								h('th', { className: 'r' }, t('lc.th.date')))),
							h('tbody', null, rows.slice(0, limit).map(function (r, i) {
								return h('tr', { key: r[5] || 'l' + i, title: r[5] || '' },
									h('td', { className: 'mono' }, r[1]),
									h('td', null, h('div', { className: 'epc-clip' }, r[3] || '—')),
									h('td', { className: 'mono dim' }, letterCode(r[1])),
									h('td', null, seriesTag(data, r[4])),
									h('td', { className: 'r mono dim' }, shortDate(r[2])));
							})))),

					rows.length > limit
						? h('div', { style: { padding: '10px 14px', borderTop: '1px solid var(--epc-line)' } },
							h('button', {
								className: 'epc-btn',
								onClick: function () { setLimit(limit + 200); }
							}, t('lc.more')))
						: null,

					h('div', { className: 'epc-note' }, t('src.letters'))));
		}

		/* ============================ meetings ============================ */
		function ViewMeetings(props) {
			var data = props.data;
			var meetings = data.meetings;
			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : defaultScope(data);
			/* Which minute books belong to a contract is configuration. A project
			   that keeps one book per package simply returns one key here. */
			var scopeKeys = meetingKeysFor(data, scope);
			var [series, setSeries] = useState('all');
			var [query, setQuery] = useState('');
			var [limit, setLimit] = useState(120);

			var all = meetings.all || [];
			var scoped = useMemo(function () {
				return all.filter(function (m) { return scopeKeys.indexOf(m.series) >= 0; });
			}, [all, scope]);
			var rows = useMemo(function () {
				var q = query.trim().toLowerCase();
				return scoped.filter(function (m) {
					if (series !== 'all' && m.series !== series) return false;
					if (q !== '' && String(m.ref + ' ' + m.title).toLowerCase().indexOf(q) < 0) return false;
					return true;
				}).sort(function (a, b) {
					var da = String(a.date || '');
					var db = String(b.date || '');
					return da < db ? 1 : da > db ? -1 : 0;
				});
			}, [scoped, series, query]);

			var keys = toEntries(meetings.bySeries).filter(function (e) { return scopeKeys.indexOf(e[0]) >= 0; });
			/* Counts, date spans, the volume chart and the 'all' chip are all
			   recomputed from the selected contract's minutes: the project-wide
			   aggregates mix employer and subcontract meetings, and the series
			   totals drift from the row list by the undated minutes. */
			var scopedStats = useMemo(function () {
				var out = {};
				scoped.forEach(function (m) {
					var k = m.series;
					if (out[k] === void 0) out[k] = { count: 0, first: null, last: null, byMonth: {} };
					var s = out[k];
					s.count += 1;
					var d = String(m.date || '');
					if (d.length >= 10) {
						if (s.first === null || d < s.first) s.first = d;
						if (s.last === null || d > s.last) s.last = d;
					}
					var mk = d.slice(0, 7);
					if (mk.length === 7) s.byMonth[mk] = (s.byMonth[mk] || 0) + 1;
				});
				return out;
			}, [scoped]);
			var scopedMonths = useMemo(function () {
				var out = {};
				Object.keys(scopedStats).forEach(function (k) {
					var byMonth = scopedStats[k].byMonth;
					Object.keys(byMonth).forEach(function (mk) { out[mk] = (out[mk] || 0) + byMonth[mk]; });
				});
				return out;
			}, [scopedStats]);
			var monthSeries = lastN(sortEntriesAsc(scopedMonths), 36);
			var scopeTotal = scoped.length;

			return h('div', { className: 'epc-wrap' },
				h(PageHead, {
					title: t('mt.title'),
					sub: t('mt.sub', { total: grouped(scopeTotal) })
				}),

				h(ContractBar, { data: data, scope: scope, onScope: props.onScope }),

				h('div', { className: 'epc-grid epc-g2' }, keys.map(function (e) {
					var s = scopedStats[e[0]] || { count: 0, first: null, last: null };
					/* one scoped series must not stretch across a two-column grid */
					return h(Kpi, {
						key: e[0],
						label: meetingLabel(data, e[0]),
						value: grouped(s.count),
						sub: shortDate(s.first) + ' → ' + shortDate(s.last)
					});
				})),

				h(Card, { title: t('mt.bymonth'), note: t('ui.months', { n: 36 }) },
					h(BarChart, { data: monthSeries, height: '96px', color: 'var(--epc-warn)' })),

				h('div', { className: 'epc-card' },
					h('div', { className: 'epc-filters' },
						h('input', {
							className: 'epc-input',
							style: { minWidth: '260px' },
							placeholder: t('lc.search'),
							value: query,
							onChange: function (e) { setQuery(e.target.value); }
						}),
						h('div', { style: { display: 'flex', gap: '6px' } },
							h('button', { className: 'epc-chip' + (series === 'all' ? ' on' : ''), onClick: function () { setSeries('all'); } }, t('action.all') + ' ' + scopeTotal),
							keys.map(function (e) {
								var s = scopedStats[e[0]] || { count: 0 };
								return h('button', {
									key: e[0],
									className: 'epc-chip' + (series === e[0] ? ' on' : ''),
									onClick: function () { setSeries(e[0]); }
								}, meetingLabel(data, e[0]) + ' ' + s.count);
							})),
						h('span', { className: 'epc-filter-count' }, t('lc.showing', { n: Math.min(limit, rows.length), total: rows.length }))),

					rows.length === 0 ? h(Empty) : h('table', { className: 'epc-tbl' },
						h('thead', null, h('tr', null,
							h('th', null, t('mt.th.ref')),
							h('th', null, t('lc.th.subject')),
							h('th', null, t('mt.th.series')),
							h('th', { className: 'r' }, t('mt.th.date')))),
						h('tbody', null, rows.slice(0, limit).map(function (m, i) {
							return h('tr', { key: m.ref || 'm' + i, title: m.title || '' },
								h('td', { className: 'mono' }, m.ref),
								h('td', null, h('div', { className: 'epc-clip' }, m.title || '—')),
								h('td', null, h(Pill, { tone: m.series === meetingKeysFor(data, mainScopeId(data))[0] ? '' : 'acc' }, meetingLabel(data, m.series))),
								h('td', { className: 'r mono dim' }, shortDate(m.date)));
						}))),

					rows.length > limit
						? h('div', { style: { padding: '10px 14px', borderTop: '1px solid var(--epc-line)' } },
							h('button', { className: 'epc-btn', onClick: function () { setLimit(limit + 200); } }, t('lc.more')))
						: null,

					h('div', { className: 'epc-note' }, t('src.meetings'))));
		}
