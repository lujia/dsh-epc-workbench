		/* ============================ commercial ============================ */
		function retentionRows(data, pkg) {
			var rows = (data.retention && data.retention[pkg]) || [];
			/* A retention sheet often has no period column at all, so a row without a
			   period is normal — only rows carrying no figure are junk (the sheet's
			   header row leaks into the extract). */
			return rows.filter(function (r) {
				return r && r.ipc && (r.retCum != null || r.retThis != null);
			});
		}

		/* The latest retention row of one contract, or — when the caller has no
		   contract in mind — of whichever package has one. */
		function lastRetention(data, key) {
			var pick = function (rows) { return rows.length ? rows[rows.length - 1] : null; };
			if (key) return pick(retentionRows(data, key));
			var ids = subScopeIds(data);
			for (var i = ids.length - 1; i >= 0; i -= 1) {
				var row = pick(retentionRows(data, ids[i]));
				if (row !== null) return row;
			}
			return null;
		}

		function ipcRows(data) {
			return (data.payments.ipcs || []).filter(function (r) { return r && r.amt != null; });
		}

		/* The register ends with four summary lines ('Balance', 'Variation',
		   'To be paid', 'Total Paid') that are not certificates, so they are
		   dropped from every count but kept in the table that shows them. */
		function isCertRow(r) {
			return /^\d/.test(String(r.sn || '').trim());
		}

		function certRows(data) {
			return ipcRows(data).filter(isCertRow);
		}

		/* main-contract certificate series */
		function mainIpas(mc) {
			return ((mc && mc.ipas) || []).filter(function (r) { return r && r.ipa != null; });
		}

		function mainLedger(mc) {
			return ((mc && mc.ledger) || []).filter(function (r) { return r && r.ipa != null; });
		}

		function viewCommercialMain(props, mc, tab, setTab) {
			var latest = mc.latest || {};
			var contract = mc.contract || {};
			var ipas = mainIpas(mc);
			var ledger = mainLedger(mc);
			var byPeriod = sortEntriesAsc(mc.byPeriod || {}).map(function (e) {
				return [e[0], e[1].lkr || 0];
			});
			var certifiedLkr = mc.totals.certifiedLkr;
			var adjustCum = latest.adjustCumLkr != null ? latest.adjustCumLkr : (ledger.length ? ledger[ledger.length - 1].contractorCum : null);
			/* same two figures the Overview band uses, so the two pages agree */
			var cap = mainCap(mc);
			var works = mainWorks(mc);
			var cur = ccyOf(props.data);

			var kpis = [
				{ label: t('mc.kpi.contractrev'), value: compact(cap), unit: cur, sub: t('mc.kpi.orig', { v: compact(contract.lkr) }) },
				{ label: t('co.kpi.main.works'), value: compact(works), unit: cur, sub: t('sub.ofvalue', { p: pct(works, cap) }) },
				{ label: t('co.kpi.main.latest'), value: compact(latest.curLkr), unit: cur, sub: 'IPA ' + (latest.ipa || '—') + ' · ' + shortDate(latest.period) },
				{ label: t('co.kpi.main.adjust'), value: compact(adjustCum), unit: cur, sub: t('sub.ofgross', { p: pct(adjustCum, latest.grossCumLkr) }) }
			];

			var kpis2 = [
				{ label: t('co.kpi.main.gross'), value: compact(latest.grossCumLkr), unit: cur, sub: 'IPA ' + (latest.ipa || '—') },
				{ label: t('co.kpi.main.advance'), value: compact(Math.abs(latest.advanceRepayCumLkr)), unit: cur, sub: t('co.main.advancepct', { n: contract.advancePct }) },
				{ label: t('co.kpi.main.retention'), value: compact(Math.abs(latest.retentionCumLkr)), unit: cur, sub: t('co.main.retentionpct', { n: contract.retentionPct }) },
				{ label: t('co.kpi.main.due'), value: compact(latest.curLkr), unit: cur, sub: t('sub.certs', { n: mc.totals.count }) }
			];

			var tabs = [
				['ipas', t('co.tab.main.ipas')],
				['adjust', t('co.tab.main.adjust')],
				['bills', t('co.tab.main.bills')],
				['statement', t('co.tab.main.summary')]
			];

			return h('div', { className: 'epc-wrap' },
				h(KpiRow, { items: kpis }),
				h(KpiRow, { items: kpis2 }),

				h('div', { className: 'epc-grid epc-g2' },
					h(Card, { title: t('co.main.chart'), note: t('sub.certs', { n: ipas.length }) },
						h(BarChart, { data: lastN(byPeriod, 30), color: 'var(--epc-good)' })),
					h(Card, { title: t('co.main.cum'), note: t('co.main.cum.note') },
						h(BarChart, {
							data: lastN(ipas.map(function (r) { return [r.period || '', r.cumLkr || 0]; }), 30),
							color: 'var(--epc-accent)'
						}))),

				h('div', { className: 'epc-card' },
					h('div', { className: 'epc-filters' },
						h('div', { className: 'epc-seg' }, tabs.map(function (pair) {
							return h('button', { key: pair[0], className: tab === pair[0] ? 'on' : '', onClick: function () { setTab(pair[0]); } }, pair[1]);
						})),
						h('span', { className: 'epc-filter-count' },
							tab === 'ipas' ? t('sub.rows', { n: ipas.length })
								: tab === 'adjust' ? t('sub.rows', { n: ledger.length })
									: tab === 'bills' ? t('sub.rows', { n: (latest.bills || []).length })
										: t('sub.rows', { n: 8 }))),

					tab === 'ipas' ? mainIpaTable(ipas, mc) : null,
					tab === 'adjust' ? mainAdjustTable(ledger) : null,
					tab === 'bills' ? mainBillTable(latest.bills || [], contract) : null,
					tab === 'statement' ? mainStatement(latest, mc, cur) : null,

					h('div', { className: 'epc-note' },
						tab === 'ipas' ? t('co.note.main.ipas', { f: mc.parsed, p: mc.pdfOnly.length })
							: tab === 'adjust' ? t('co.note.main.adjust')
								: tab === 'bills' ? t('co.note.main.bills', { ipa: latest.ipa || '—' })
									: t('co.note.main.summary'))));
		}

		function ViewCommercial(props) {
			var data = props.data;
			var mc = data.mainContract;
			var mainId = mainScopeId(data);
			var [tabState, setTab] = useState(mc ? 'ipas' : 'ipcs');
			var [scopeLocal, setScopeLocal] = useState(mainId);
			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : scopeLocal;
			/* the package and the scope are the same choice: picking a package in
			   the register strip must move the retention table with it */
			var pkg = scope;
			var isMain = isMainScope(data, scope);
			var cur = ccyOf(data);

			/* the main-contract and subcontract tab sets do not overlap, so a tab left
			   over from the other scope must fall back rather than render nothing */
			var MAIN_TABS = ['ipas', 'adjust', 'bills', 'statement'];
			var SUB_TABS = ['ipcs', 'employer', 'retention', 'boq'];
			var tab = isMain
				? (MAIN_TABS.indexOf(tabState) >= 0 ? tabState : 'ipas')
				: (SUB_TABS.indexOf(tabState) >= 0 ? tabState : 'ipcs');

			function pick(next) {
				setScopeLocal(next);
				setTab(isMainScope(data, next) ? 'ipas' : 'ipcs');
				if (typeof props.onScope === 'function') props.onScope(next);
			}

			/* One button per contract, labelled from the register, so the strip
			   works for a project with two contracts as well as for one with five. */
			var actions = h('div', { className: 'epc-seg' },
				contractList(data).map(function (c) {
					return h('button', {
						key: c.id,
						className: scope === c.id ? 'on' : '',
						onClick: function () { pick(c.id); }
					}, c.label || c.id);
				}));

			var head = h(PageHead, {
				title: t('co.title'),
				sub: isMain && mc ? t('co.sub.main', { no: (mc.contract || {}).no }) : t('co.sub'),
				actions: actions
			});

			if (isMain && mc) {
				return h('div', null, head, viewCommercialMain(props, mc, tab, setTab));
			}

			var payments = data.payments;
			var totals = payments.totals;

			var ret = lastRetention(data, pkg);
			var ipcs = ipcRows(data);
			var certs = certRows(data);
			var paidMonths = lastN(sortEntriesAsc(payments.paidByMonth || {}), 24);

			var tabs = [
				['ipcs', t('co.tab.ipcs')],
				['employer', t('co.tab.employer')],
				['retention', t('co.tab.retention')],
				['boq', t('co.tab.boq')]
			];

			var kpis = [
				{ label: t('co.kpi.certified'), value: compact(totals.certified), unit: cur, sub: t('sub.certs', { n: certs.length }) },
				{ label: t('co.kpi.paid'), value: compact(totals.paid), unit: cur, sub: t('sub.ofcertified', { p: pct(totals.paid, totals.certified) }) },
				{ label: t('co.kpi.unpaid'), value: compact(totals.unpaidAmount), unit: cur, sub: t('sub.opencerts', { n: totals.unpaidCount }) },
				{ label: t('co.kpi.lag'), value: String(payments.lag.avg), unit: t('co.kpi.lag.unit'), sub: t('co.lag.max') + ' ' + payments.lag.max + ' · ' + t('co.lag.n') + ' ' + payments.lag.n }
			];

			var kpis2 = [
				{ label: t('co.kpi.invoiced'), value: compact(totals.employerInvoiced), unit: cur, sub: t('sub.invoices', { n: (payments.employer || []).length }) },
				{ label: t('co.kpi.received'), value: compact(totals.employerReceived), unit: cur, sub: t('sub.collected', { p: pct(totals.employerReceived, totals.employerInvoiced) }) },
				{ label: t('co.kpi.retention'), value: compact(ret ? ret.retCum : null), unit: cur, sub: pkg + ' · ' + shortDate(ret ? ret.period : null) },
				{ label: t('co.kpi.advance'), value: compact(ret ? ret.advCum : null), unit: cur, sub: pkg + ' ' + (ret ? ret.ipc : '') }
			];

			return h('div', { className: 'epc-wrap' },
				head,

				h(KpiRow, { items: kpis }),
				h(KpiRow, { items: kpis2 }),

				h('div', { className: 'epc-grid epc-g2' },
					h(Card, { title: t('co.chart.paid'), note: t('ui.months', { n: 24 }) }, h(BarChart, { data: paidMonths, color: 'var(--epc-accent)' })),
					h(Card, { title: t('co.chart.employer'), note: t('ui.months', { n: 24 }) },
						h(BarChart, { data: lastN(sortEntriesAsc(payments.employerInvoicedByMonth || {}), 24), color: 'var(--epc-good)' }))),

				h('div', { className: 'epc-card' },
					h('div', { className: 'epc-filters' },
						h('div', { className: 'epc-seg' }, tabs.map(function (pair) {
							return h('button', { key: pair[0], className: tab === pair[0] ? 'on' : '', onClick: function () { setTab(pair[0]); } }, pair[1]);
						})),
						h('span', { className: 'epc-filter-count' },
							tab === 'ipcs' ? t('sub.rows', { n: ipcs.length })
								: tab === 'employer' ? t('sub.rows', { n: (payments.employer || []).length })
									: tab === 'retention' ? t('sub.rows', { n: retentionRows(data, pkg).length })
										: t('sub.rows', { n: (data.certificate.items || []).length }))),

					tab === 'ipcs' ? ipcTable(ipcs) : null,
					tab === 'employer' ? employerTable(payments.employer || []) : null,
					tab === 'retention' ? retentionTable(retentionRows(data, pkg)) : null,
					tab === 'boq' ? boqTable(data.certificate) : null,

					h('div', { className: 'epc-note' },
						tab === 'ipcs' ? t('co.note.ipcs')
							: tab === 'employer' ? t('co.note.employer')
								: tab === 'retention' ? t('co.note.retention')
									: t('co.note.boq', { no: data.certificate.no }))));
		}

		function ipcTable(rows) {
			var sorted = rows.slice().sort(function (a, b) {
				var da = String(a.date || '');
				var db = String(b.date || '');
				return da < db ? 1 : da > db ? -1 : 0;
			});
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ipc')),
					h('th', null, t('th.date')),
					h('th', { className: 'r' }, t('th.certified')),
					h('th', { className: 'r' }, t('th.vat')),
					h('th', { className: 'r' }, t('th.paid')),
					h('th', null, t('th.paydate')),
					h('th', { className: 'r' }, t('th.lag')),
					h('th', { className: 'r' }, t('th.fx')),
					h('th', null, t('th.note')))),
				h('tbody', null, sorted.map(function (r, i) {
					var lag = r.date && r.payDate ? daysBetween(r.date, r.payDate) : null;
					return h('tr', { key: 'i' + i },
						h('td', { className: 'mono' }, (r.sn === '0' ? 'Advance' : 'IPC ' + r.sn)),
						h('td', { className: 'mono dim' }, shortDate(r.date)),
						h('td', { className: 'r mono' }, grouped(r.certified, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.vat, 2)),
						h('td', { className: 'r mono' }, grouped(r.amt, 2)),
						h('td', { className: 'mono dim' }, shortDate(r.payDate)),
						h('td', { className: 'r mono' }, lag == null ? '—' : String(lag)),
						h('td', { className: 'r mono dim' }, isNum(r.fxLkr) ? r.fxLkr.toFixed(2) : '—'),
						h('td', { className: 'dim' }, h('div', { className: 'epc-clip', style: { maxWidth: '260px' } }, r.note || '—')));
				})));
		}

		function employerTable(rows) {
			var sorted = rows.slice().sort(function (a, b) {
				var da = String(a.date || '');
				var db = String(b.date || '');
				return da < db ? 1 : da > db ? -1 : 0;
			});
			if (sorted.length === 0) return h(Empty, null, t('co.empty'));
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ref')),
					h('th', null, t('th.date')),
					h('th', { className: 'r' }, t('th.amount')),
					h('th', { className: 'r' }, t('th.tax')),
					h('th', { className: 'r' }, t('th.total')),
					h('th', { className: 'r' }, t('th.received')),
					h('th', null, t('th.recvdate')),
					h('th', null, t('th.note')))),
				h('tbody', null, sorted.map(function (r, i) {
					return h('tr', { key: 'c' + i },
						h('td', { className: 'mono' }, r.no || '—'),
						h('td', { className: 'mono dim' }, shortDate(r.date)),
						h('td', { className: 'r mono' }, grouped(r.amt, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.tax, 2)),
						h('td', { className: 'r mono' }, grouped(r.total, 2)),
						h('td', { className: 'r mono', style: { color: isNum(r.recv) && r.recv > 0 ? 'var(--epc-good)' : 'var(--epc-dim)' } }, grouped(r.recv, 2)),
						h('td', { className: 'mono dim' }, shortDate(r.recvDate)),
						h('td', { className: 'dim' }, h('div', { className: 'epc-clip', style: { maxWidth: '220px' } }, r.note || '—')));
				})));
		}

		function retentionTable(rows) {
			if (rows.length === 0) return h(Empty, null, t('co.empty'));
			var sorted = rows.slice().sort(function (a, b) {
				var da = String(a.period || '');
				var db = String(b.period || '');
				return da < db ? 1 : da > db ? -1 : 0;
			});
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ipc')),
					h('th', null, t('th.period')),
					h('th', { className: 'r' }, t('th.retthis')),
					h('th', { className: 'r' }, t('th.retcum')),
					h('th', { className: 'r' }, t('th.advthis')),
					h('th', { className: 'r' }, t('th.advcum')))),
				h('tbody', null, sorted.map(function (r, i) {
					return h('tr', { key: 'r' + i },
						h('td', { className: 'mono' }, r.ipc),
						h('td', { className: 'mono dim' }, shortDate(r.period)),
						h('td', { className: 'r mono' }, grouped(r.retThis, 2)),
						h('td', { className: 'r mono' }, grouped(r.retCum, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.advThis, 2)),
						h('td', { className: 'r mono' }, grouped(r.advCum, 2)));
				})));
		}

		function boqTable(cert) {
			var items = (cert.items || []).filter(function (it) { return it && it.desc; });
			if (items.length === 0) return h(Empty, null, t('co.empty'));
			var totalBoq = sumBy(items, 'boq');
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.code')),
					h('th', null, t('th.desc')),
					h('th', { className: 'r' }, t('th.boq')),
					h('th', { className: 'r' }, t('th.prev')),
					h('th', { className: 'r' }, t('th.cur')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', { style: { width: '120px' } }, t('th.share')))),
				h('tbody', null, items.map(function (it, i) {
					var share = isNum(it.boq) && it.boq > 0 && isNum(it.cum) ? it.cum / it.boq : 0;
					return h('tr', { key: 'b' + i },
						h('td', { className: 'mono' }, it.code),
						h('td', null, h('div', { className: 'epc-clip' }, String(it.desc).trim())),
						h('td', { className: 'r mono dim' }, grouped(it.boq, 0)),
						h('td', { className: 'r mono dim' }, grouped(it.prev, 0)),
						h('td', { className: 'r mono' }, grouped(it.cur, 0)),
						h('td', { className: 'r mono' }, grouped(it.cum, 0)),
						h('td', null,
							h(ProgressBar, {
								value: share,
								color: share >= 1 ? 'var(--epc-good)' : 'var(--epc-accent)',
								title: (share * 100).toFixed(1) + '%'
							})));
				})),
				h('tfoot', null, h('tr', null,
					h('td', { colSpan: 2, style: { padding: '8px 12px', fontWeight: 650 } }, t('ui.total')),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(totalBoq, 0)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'prev'), 0)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'cur'), 0)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'cum'), 0)),
					h('td', null))));
		}

		/* ---- main-contract tables ---- */

		function mainIpaTable(rows, mc) {
			if (rows.length === 0) return h(Empty, null, t('co.empty'));
			var sorted = rows.slice().sort(function (a, b) {
				return (b.ipa || 0) - (a.ipa || 0);
			});
			/* The share column measures the cumulative certificate against the revised
			   price, not the original sum: the cumulative figure carries the price
			   adjustment, so against the original sum it would pass 100% and read as
			   an arithmetic error rather than as an escalation claim. */
			var contractLkr = mainCap(mc);
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ipa')),
					h('th', null, t('th.period')),
					h('th', { className: 'r' }, t('th.certified')),
					h('th', { className: 'r' }, t('th.certified.usd')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', { className: 'r' }, t('th.cum.usd')),
					h('th', { style: { width: '120px' } }, t('th.share')))),
				h('tbody', null, sorted.map(function (r, i) {
					var share = isNum(contractLkr) && contractLkr > 0 && isNum(r.cumLkr) ? r.cumLkr / contractLkr : 0;
					return h('tr', { key: 'm' + i },
						h('td', { className: 'mono' }, 'IPA ' + r.ipa),
						h('td', { className: 'mono dim' }, shortDate(r.period)),
						h('td', { className: 'r mono' }, grouped(r.curLkr, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.curUsd, 2)),
						h('td', { className: 'r mono' }, grouped(r.cumLkr, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.cumUsd, 2)),
						h('td', null,
							h(ProgressBar, {
								value: share,
								color: share >= 1 ? 'var(--epc-good)' : 'var(--epc-accent)',
								title: (share * 100).toFixed(1) + '%'
							})));
				})),
				h('tfoot', null, h('tr', null,
					h('td', { colSpan: 2, style: { padding: '8px 12px', fontWeight: 650 } }, t('ui.total')),
					h('td', null),
					h('td', null),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(mc.totals.certifiedLkr, 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(mc.totals.certifiedUsd, 2)),
					h('td', null))));
		}

		function mainAdjustTable(rows) {
			if (rows.length === 0) return h(Empty, null, t('co.empty'));
			var sorted = rows.slice().sort(function (a, b) { return (a.ipa || 0) - (b.ipa || 0); });
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ipa')),
					h('th', { className: 'r' }, t('th.certified')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', { className: 'r' }, t('co.th.employerMonth')),
					h('th', { className: 'r' }, t('co.th.employerCum')),
					h('th', { className: 'r' }, t('co.th.contractorMonth')),
					h('th', { className: 'r' }, t('co.th.contractorCum')),
					h('th', null, t('th.note')))),
				h('tbody', null, sorted.map(function (r, i) {
					return h('tr', { key: 'a' + i },
						h('td', { className: 'mono' }, 'IPA ' + r.ipa),
						h('td', { className: 'r mono' }, grouped(r.monthly, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.cumulative, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.employerMonth, 2)),
						h('td', { className: 'r mono' }, grouped(r.employerCum, 2)),
						h('td', { className: 'r mono dim' }, grouped(r.contractorMonth, 2)),
						h('td', { className: 'r mono' }, grouped(r.contractorCum, 2)),
						h('td', { className: 'dim' }, h('div', { className: 'epc-clip', style: { maxWidth: '240px' } }, r.remark || '—')));
				})));
		}

		function mainBillTable(bills, contract) {
			var items = (bills || []).filter(function (b) { return b && b.desc; });
			if (items.length === 0) return h(Empty, null, t('co.empty'));
			/* The main contract is a mixed-currency sum (the second currency plus the
			   columns are shown — 'Mandatory Spare Parts', for one, is entirely in
			   primary one), so both columns are rendered: a bill priced only in the second
   currency would read as zero if only the primary column were shown. */
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.code')),
					h('th', null, t('th.desc')),
					h('th', { className: 'r' }, t('th.contract') + ' US$'),
					h('th', { className: 'r' }, t('th.contract') + ' ' + cur),
					h('th', { className: 'r' }, t('co.th.curusd')),
					h('th', { className: 'r' }, t('co.th.cur')),
					h('th', { className: 'r' }, t('th.cum.usd')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', { className: 'r', style: { width: '78px' } }, t('th.share')))),
				h('tbody', null, items.map(function (b, i) {
					var basis = isNum(b.contractLkr) && b.contractLkr > 0 ? b.contractLkr : null;
					var share = basis !== null && isNum(b.cumLkr) ? b.cumLkr / basis
						: (isNum(b.contractUsd) && b.contractUsd > 0 && isNum(b.cumUsd) ? b.cumUsd / b.contractUsd : null);
					return h('tr', { key: 'bl' + i },
						h('td', { className: 'mono' }, b.code || '—'),
						h('td', null, h('div', { className: 'epc-clip', style: { maxWidth: '290px' } }, String(b.desc).trim())),
						h('td', { className: 'r mono dim' }, grouped(b.contractUsd, 2)),
						h('td', { className: 'r mono dim' }, grouped(b.contractLkr, 2)),
						h('td', { className: 'r mono' }, grouped(b.curUsd, 2)),
						h('td', { className: 'r mono' }, grouped(b.curLkr, 2)),
						h('td', { className: 'r mono dim' }, grouped(b.cumUsd, 2)),
						h('td', { className: 'r mono' }, grouped(b.cumLkr, 2)),
						h('td', { className: 'r mono dim' },
							share === null ? '—' : (share * 100).toFixed(1) + '%'));
				})),
				h('tfoot', null, h('tr', null,
					h('td', { colSpan: 2, style: { padding: '8px 12px', fontWeight: 650 } }, t('ui.total')),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'contractUsd'), 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'contractLkr'), 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'curUsd'), 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'curLkr'), 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'cumUsd'), 2)),
					h('td', { className: 'r mono', style: { padding: '8px 12px' } }, grouped(sumBy(items, 'cumLkr'), 2)),
					h('td', null))));
		}

		function mainStatement(latest, mc, cur) {
			var ledger = mainLedger(mc);
			var adjust = latest.adjustCumLkr != null ? latest.adjustCumLkr
				: (ledger.length ? ledger[ledger.length - 1].contractorCum : null);
			var rows = [
				['co.st.gross', latest.grossCumLkr, t('co.st.gross.note')],
				['co.st.adjust', adjust, null],
				['co.st.advance', latest.advanceRepayCumLkr, latest.advanceCumLkr != null ? t('co.st.advance.note', { v: grouped(latest.advanceCumLkr, 2) }) : null],
				['co.st.retention', latest.retentionCumLkr, t('co.st.retention.note', { n: (mc.contract || {}).retentionPct })],
				['co.st.deductions', latest.deductionsCumLkr, null],
				['co.st.total', latest.totalCumLkr, t('co.st.total.note')],
				['co.st.present', latest.presentCumLkr, null],
				['co.st.due', latest.curLkr, t('co.st.due.note', { d: shortDate(latest.period) })]
			];

			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('co.th.line')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', null, t('th.note')))),
				h('tbody', null, rows.map(function (r, i) {
					var emph = r[0] === 'co.st.total' || r[0] === 'co.st.due';
					return h('tr', { key: 's' + i },
						h('td', { style: emph ? { fontWeight: 650 } : null }, t(r[0])),
						h('td', {
							className: 'r mono',
							style: {
								fontWeight: emph ? 650 : null,
								color: isNum(r[1]) && r[1] < 0 ? 'var(--epc-dim)' : null
							}
						}, grouped(r[1], 2)),
						h('td', { className: 'dim' }, h('div', { className: 'epc-clip', style: { maxWidth: '320px' } }, r[2] || '—')));
				})));
		}
