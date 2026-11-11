		/* ============================ overview ============================ */
		/* Series pills carry a tone that says which way the letter travelled and
		   which side of the contract it belongs to. Both facts are in the
		   taxonomy, so no series name is spelled out here. */
		function seriesTone(data, series) {
			var side = seriesSide(data, series);
			if (side === 'received') return 'warn';
			return 'acc';
		}

		function seriesTag(data, series) {
			var label = seriesLabel(data, series);
			return h(Pill, { tone: seriesTone(data, series), dot: true }, label);
		}

		function ViewOverview(props) {
			var data = props.data;
			var project = data.project;
			var letters = data.letters;
			var payments = data.payments;
			var defects = data.defects;
			var meetings = data.meetings;
			var cert = data.certificate;
			var docs = data.docs;
			var scope = props.scope != null && props.scope !== '' ? resolveScope(data, props.scope) : defaultScope(data);
			var issuedCount = (docs.toc || []).filter(function (d) { return d.state === 'issued'; }).length;
			var draftCount = (docs.toc || []).filter(function (d) { return d.state !== 'issued'; }).length;

			/* The subcontracts together are the scope of the certificate series,
			   which is kept as one cumulative register rather than per package. */
			var contractValue = subScopeIds(data).reduce(function (acc, id) {
				var c = contractById(data, id);
				return acc + (c && isNum(c.value) ? c.value : 0);
			}, 0);
			var certCum = cert && cert.summary ? cert.summary.cumulative : null;
			var certShare = isNum(certCum) && contractValue > 0 ? certCum / contractValue : null;

			var flow = sortEntriesAsc(letters.byMonth || {});
			var payFlow = lastN(sortEntriesAsc(payments.paidByMonth || {}), 24);
			/* Receipts beat certifications for the employer side: a certificate is a
			   claim, the cash arrives only when the employer pays it, and the gap
			   is exactly what a contract manager watches. */
			var mcFlow = (function () {
				var byMonth = {};
				((data.mainContract || {}).ipas || []).forEach(function (r) {
					if (r.ipa == null || !r.period) return;
					var key = String(r.period).slice(0, 7);
					var v = r.curLkr != null ? r.curLkr : 0;
					byMonth[key] = (byMonth[key] || 0) + v;
				});
				return lastN(sortEntriesAsc(byMonth), 24);
			})();
			var gradeKeys = toEntries(defects.byGrade || {}).sort(function (a, b) { return b[1] - a[1]; });
			var gradeMax = gradeKeys.length ? gradeKeys[0][1] : 1;
			var discEntries = toEntries(defects.byDiscipline || {}).sort(function (a, b) { return b[1] - a[1]; });
			var pkgEntries = toEntries(letters.byPkg || {}).sort(function (a, b) { return String(a[0]) < String(b[0]) ? -1 : 1; });
			var pkgTotal = pkgEntries.reduce(function (acc, e) { return acc + e[1]; }, 0);
			/* The first subcontract carries the accent in the package mix; any
			   further package cycles through the remaining semantic colours. */
			var subFirst = subScopeIds(data)[0] || '';

			/* The first band is the money band, and it has to follow the selected
			   contract: the main contract is certified by the employer in the
			   currencies the contract is priced in, while the subcontracts are
			   certified by the contractor. Showing the subcontract totals while the
			   register says 'main contract' would be the most misleading thing this
			   page could do.
			   Every amount here is a list of currency slices rather than one number,
			   because a contract can be priced in more than one currency and no
			   slice is a conversion of another. */
			var mc = data.mainContract;
			var mcLatest = (mc && mc.latest) || {};
			var mcContract = (mc && mc.contract) || {};
			var cur = ccyOf(data);
			var ccyFirst = ccyList(data)[0] || {};
			var mcCap = mainCap(mc);
			/* Shared with the Commercial view so the two pages cannot disagree about
			   either the progress cap or the works valuation. */
			var mcWork = mainWorks(mc);
			var mcCapSlices = mainCapSlices(mc, data);
			var mcOrigSlices = mainOrigSlices(mc, data);
			var mcWorksSlices = mainWorksSlices(mc, data);
			var contract = contractById(data, scope) || {};
			var mainScope = isMainScope(data, scope);

			var kpis;
			if (mainScope && mc && mc.totals) {
				var mcAdjust = mcLatest.adjustCumLkr != null ? mcLatest.adjustCumLkr
					: (mc.ledger && mc.ledger.length ? mc.ledger[mc.ledger.length - 1].contractorCum : null);
				var mcAdjustSlices = rowSlices(mcLatest, 'adjustCum', data);
				if (mcAdjustSlices.length === 0 && isNum(mcAdjust)) {
					mcAdjustSlices = [{ label: ccyFirst.label || '', amount: mcAdjust }];
				}
				kpis = [
					/* The revised price is the one the certificate card measures against,
					   so the band uses it too — otherwise the tile would say 99% while the
					   card below it said 88% for the same contract. The original sum is
					   the same slices before escalation, printed per currency as well. */
					moneyKpi('mc.kpi.contractrev', mcCapSlices, { sub: t('mc.kpi.orig', { v: moneyText(mcOrigSlices) }) }),
					moneyKpi('mc.kpi.certified', mcWorksSlices, { sub: t('sub.ofvalue', { p: pct(mcWork, mcCap) }) }),
					/* Same shape as the other tiles: the first currency keeps the large
					   figure and the rest stack beneath it. */
					moneyKpi('mc.kpi.latest', rowSlices(mcLatest, 'cur', data), { sub: 'IPA ' + (mcLatest.ipa || '—') + ' · ' + shortDate(mcLatest.period) }),
					moneyKpi('mc.kpi.adjust', mcAdjustSlices, { sub: t('sub.ofgross', { p: pct(mcAdjust, mcLatest.grossCumLkr) }) })
				];
			} else {
				var ret = lastRetention(data, scope);
				var pkgRetention = retentionRows(data, scope);
				var pkgCcy = contract.currency || '';
				var pkgSlices = function (amount) {
					return [{ label: ccyLabelFor(data, pkgCcy), amount: amount }];
				};
				/* The certified and paid ledgers are kept per package only for
				   retention and advance; the certificate totals are a single
				   combined series, so the label says so rather than implying
				   the number belongs to the selected package alone. */
				kpis = [
					moneyKpi('ov.kpi.contract', sliceList(contract.amounts, data).length
						? sliceList(contract.amounts, data)
						: pkgSlices(contract.value), { sub: contract.no }),
					moneyKpi('co.kpi.certified.all', pkgSlices(payments.totals.certified), { sub: t('sub.certs', { n: certRows(data).length }) }),
					moneyKpi('co.kpi.retention', pkgSlices(ret ? ret.retCum : null), { sub: t('sub.certs', { n: pkgRetention.length }) }),
					moneyKpi('co.kpi.advance', pkgSlices(ret ? ret.advCum : null), { sub: (ret ? ret.ipc : '—') })
				];
			}

			/* The lag block has to follow the contract as well. Under the main contract
			   the relevant cycle is invoice → receipt from the employer, which the
			   receipt register records; under a subcontract it is the contractor's
			   certificate → payment to the subcontractor. */
			var lag = (function () {
				var lags = [];
				if (mainScope) {
					(payments.employer || []).forEach(function (r) {
						var d = daysBetween(r.date, r.recvDate);
						if (d !== null && d >= 0) lags.push(d);
					});
				} else {
					(payments.ipcs || []).forEach(function (r) {
						if (!/^\d/.test(String(r.sn || '').trim())) return;
						var d = daysBetween(r.date, r.payDate);
						if (d !== null && d >= 0) lags.push(d);
					});
				}
				if (lags.length === 0) return payments.lag;
				lags.sort(function (a, b) { return a - b; });
				return {
					avg: Math.round((lags.reduce(function (s, v) { return s + v; }, 0) / lags.length) * 10) / 10,
					median: lags[Math.floor(lags.length / 2)],
					max: lags[lags.length - 1],
					n: lags.length
				};
			})();

			var kpis2 = [
				{ label: t('ov.kpi.letters'), value: grouped(letters.total), unit: null, sub: t('sub.dated', { n: grouped(letters.dated) }) },
				{ label: t('ov.kpi.meetings'), value: grouped(meetings.total), unit: null, sub: meetingSummary(data) },
				{ label: t('ov.kpi.defects'), value: grouped(defects.openCount), unit: null, sub: t('sub.logged', { n: grouped(defects.total) }) },
				{ label: t('ov.kpi.overdue'), value: grouped(defects.overdueCount), unit: null, sub: t('sub.ofopen', { p: pct(defects.overdueCount, defects.openCount) }) }
			];

			return h('div', { className: 'epc-wrap' },
				h(PageHead, {
					title: t('ov.title'),
					sub: t('ov.sub', { name: project.name, site: project.site })
				}),

				h(ContractBar, { data: data, scope: scope, onScope: props.onScope }),

				h(KpiRow, { items: kpis }),
				h(KpiRow, { items: kpis2 }),

				h('div', { className: 'epc-grid epc-g23' },
					mainScope && mc && mc.latest
						? h(Card, {
							title: t('ov.cert.title'),
							note: 'IPA ' + mcLatest.ipa + ' · ' + shortDate(mcLatest.period)
						},
							h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
								h('div', null,
									h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } },
										h('span', { style: { fontSize: '11.5px', color: 'var(--epc-muted)' } }, t('co.st.total')),
										h('span', { className: 'epc-mono', style: { fontSize: '15px', fontWeight: 650 } }, moneyText(rowSlices(mcLatest, 'totalCum', data), 2))),
									/* The revised contract price is the right denominator for progress, and
									   the numerator has to be the works valuation only: price adjustment
									   sits on top of the contract price rather than inside it, so
									   measuring net certified against it would push the bar past 100%
									   and read as an error rather than as an escalation claim.
									   The bar is a ratio, so it stays on the primary currency: dividing
									   a valuation in one currency by a price in another is a number
									   without a meaning. */
									h(ProgressBar, { value: mcCap > 0 ? Math.min(1, mcWork / mcCap) : 0, title: pct(mcWork, mcCap) }),
									h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: 'var(--epc-dim)' } },
										h('span', null, t('ov.cert.workrevised', { p: pct(mcWork, mcCap) })),
										h('span', null, moneyText(mcCapSlices)))),
								/* Every line of the closing statement is certified in each
								   currency the contract is priced in, so each row prints all
								   of them. */
								h('dl', { className: 'epc-kv' },
									h('dt', null, t('co.st.gross')), h('dd', { className: 'epc-mono' }, moneyText(rowSlices(mcLatest, 'grossCum', data), 2)),
									h('dt', null, t('co.st.adjust')), h('dd', { className: 'epc-mono' }, moneyText(rowSlices(mcLatest, 'adjustCum', data), 2)),
									/* The label says repayment, so the figure has to be the deduction
									   rather than the advance originally paid — otherwise the row reads
									   as a positive addition to the certified value. */
									h('dt', null, t('co.st.advance')), h('dd', { className: 'epc-mono' },
										moneyText(rowSlices(mcLatest, 'advanceRepayCum', data).length
											? rowSlices(mcLatest, 'advanceRepayCum', data)
											: rowSlices(mcLatest, 'advanceCum', data).map(function (e) {
												return { label: e.label, amount: -e.amount };
											}), 2)),
									h('dt', null, t('co.st.retention')), h('dd', { className: 'epc-mono' }, moneyText(rowSlices(mcLatest, 'retentionCum', data), 2)),
									h('dt', null, t('co.st.deductions')), h('dd', { className: 'epc-mono' }, moneyText(rowSlices(mcLatest, 'deductionsCum', data), 2)),
									h('dt', null, t('co.st.due')), h('dd', { className: 'epc-mono', style: { fontWeight: 650, color: 'var(--epc-accent)' } }, moneyText(rowSlices(mcLatest, 'dueCum', data), 2)))))

						: h(Card, {
							title: t('ov.cert.title'),
							note: t('ov.cert.note', { no: cert.no, period: shortDate(cert.period) }) + ' · ' + subScopeIds(data).join(' + ')
						},
							h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
								h('div', null,
									h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } },
										h('span', { style: { fontSize: '11.5px', color: 'var(--epc-muted)' } }, t('ov.cert.cumulative')),
										h('span', { className: 'epc-mono', style: { fontSize: '15px', fontWeight: 650 } }, grouped(cert.summary.cumulative, 2))),
									h(ProgressBar, { value: certShare || 0, title: pct(certCum, contractValue) }),
									h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: 'var(--epc-dim)' } },
										h('span', null, t('ov.cert.ofvalue', { p: pct(certCum, contractValue) })),
										h('span', null, grouped(contractValue)))),
								h('dl', { className: 'epc-kv' },
									h('dt', null, t('ov.cert.previous')), h('dd', { className: 'epc-mono' }, grouped(cert.summary.previous, 2)),
									h('dt', null, t('ov.cert.current')), h('dd', { className: 'epc-mono' }, grouped(cert.summary.current, 2)),
									h('dt', null, t('ov.cert.advance')), h('dd', { className: 'epc-mono' }, grouped(cert.summary.advanceRecovery, 2)),
									h('dt', null, t('ov.cert.retention')), h('dd', { className: 'epc-mono' }, grouped(cert.summary.retention, 2)),
									h('dt', null, t('ov.cert.net')), h('dd', { className: 'epc-mono', style: { fontWeight: 650, color: 'var(--epc-accent)' } }, grouped(cert.summary.netCertified, 2))))),

					h(Card, { title: t('ov.contract.title') },
						h('div', { style: { display: 'flex', flexDirection: 'column' } },
							partyList(data).map(function (p) {
								return h(PartyRow, {
									key: 'p-' + p.id,
									role: t('scope.' + String(p.role || p.id).toLowerCase()),
									name: p.name,
									former: p.former
								});
							})),
						h('dl', { className: 'epc-kv', style: { marginTop: '12px' } },
							(contractList(data) || []).map(function (c) {
								return h('div', { key: 'c-' + c.id, style: { display: 'contents' } },
									h('dt', null, c.label || c.id),
									h('dd', { className: 'epc-mono' }, c.no + ' · ' + moneyText(sliceList(c.amounts, data).length
										? sliceList(c.amounts, data)
										: [{ label: ccyLabelFor(data, c.currency), amount: c.value }])));
							})),
						h('div', { className: 'epc-note', style: { borderTop: 0, padding: '8px 0 0', background: 'transparent' } }, t('scope.rename.note')),
						h('div', { style: { marginTop: '2px' } },
							h('div', { className: 'epc-splitline' }, mainScope ? t('ov.flow.note3') : t('ov.flow.note2')),
							h('div', { style: { display: 'flex', gap: '16px', marginTop: '6px' } },
								h('div', null,
									h('div', { className: 'epc-kpi-k' }, t('co.lag.avg')),
									h('div', { className: 'epc-mono', style: { fontSize: '16px', fontWeight: 650 } }, lag.avg + 'd')),
								h('div', null,
									h('div', { className: 'epc-kpi-k' }, t('co.lag.max')),
									h('div', { className: 'epc-mono', style: { fontSize: '16px', fontWeight: 650 } }, lag.max + 'd')),
								h('div', null,
									h('div', { className: 'epc-kpi-k' }, t('co.lag.n')),
									h('div', { className: 'epc-mono', style: { fontSize: '16px', fontWeight: 650 } }, String(lag.n))))))),

				h('div', { className: 'epc-grid epc-g2' },
					h(Card, { title: t('ov.flow.title'), note: t('ov.flow.note') },
						h(BarChart, { data: flow.slice(-42), unit: 'letters' })),
					h(Card, {
						title: t('ov.flow.title2'),
						note: mainScope ? t('ov.flow.note.main') : t('ov.flow.note2')
					},
						h(BarChart, {
							data: mainScope ? mcFlow : payFlow,
							unit: cur,
							color: 'var(--epc-good)'
						}))),

				h('div', { className: 'epc-grid epc-g3' },
					h(Card, { title: t('ov.grade.title'), note: t('ov.grade.note') },
						h('div', { className: 'epc-lbars' }, gradeKeys.map(function (e, i) {
							return h(ListBar, {
								key: 'g' + i,
								label: e[0] === '—' ? t('ql.ungraded') : t('ql.grade', { g: e[0] }),
								value: e[1],
								max: gradeMax,
								color: e[0] === 'A' ? 'var(--epc-crit)' : e[0] === 'B' ? 'var(--epc-warn)' : 'var(--epc-accent)'
							});
						}))),
					h(Card, { title: t('ov.disc.title') },
						h('div', { className: 'epc-lbars' }, discEntries.map(function (e, i) {
							var label = t('ql.disc.' + String(e[0]).toLowerCase()) || e[0];
							return h(ListBar, { key: 'd' + i, label: label, value: e[1], max: discEntries[0][1] });
						}))),
					h(Card, { title: t('ov.pkg.title') },
						h('div', null,
							h('div', { className: 'epc-prog', style: { height: '10px' } },
								pkgEntries.map(function (e) {
									return h('i', {
										key: e[0],
										style: {
											width: (pkgTotal ? (e[1] / pkgTotal) * 100 : 0).toFixed(2) + '%',
											background: e[0] === subFirst ? 'var(--epc-accent)' : 'var(--epc-good)'
										}
									});
								})),
							h('div', { className: 'epc-legend' }, pkgEntries.map(function (e) {
								return h('span', { key: e[0] },
									h('i', { className: 'epc-swatch', style: { background: e[0] === subFirst ? 'var(--epc-accent)' : 'var(--epc-good)' } }),
									e[0] + ' · ' + e[1] + ' (' + pct(e[1], pkgTotal) + ')');
							})),
							h('div', { className: 'epc-splitline', style: { marginTop: '14px' } }, t('lc.bycode')),
							h('div', { className: 'epc-lbars' }, topEntries(letters.byCode || {}, 6).map(function (e, i) {
								return h(ListBar, { key: 'c' + i, label: e[0], value: e[1], max: topEntries(letters.byCode || {}, 1)[0][1] });
							}))))),

				h(Card, {
					title: t('ov.recent.title'),
					note: t('ov.recent.note'),
					flush: true
				},
					h('table', { className: 'epc-tbl' },
						h('thead', null, h('tr', null,
							h('th', null, t('lc.th.no')),
							h('th', null, t('lc.th.subject')),
							h('th', null, t('lc.th.series')),
							h('th', { className: 'r' }, t('lc.th.date')))),
						h('tbody', null, (letters.recent || []).slice(0, 12).map(function (row, i) {
							return h('tr', { key: 'r' + i },
								h('td', { className: 'mono' }, row.no),
								h('td', null, h('div', { className: 'epc-clip' }, row.subj)),
								h('td', null, seriesTag(data, row.series)),
								h('td', { className: 'r mono dim' }, shortDate(row.date)));
						})))),

				h('div', { className: 'epc-grid epc-g3' },
					h(Card, { title: t('ov.milestone.title') },
						h('dl', { className: 'epc-kv' },
							h('dt', null, t('dc.contracts')), h('dd', null, String(docs.contracts.length) + ' ' + t('dc.files')),
							h('dt', null, t('dc.toc')), h('dd', null, t('dc.toc.issued') + ' × ' + issuedCount + ' · ' + t('dc.toc.draft') + ' × ' + draftCount),
							h('dt', null, t('dc.materials')), h('dd', null, String(docs.materials.length)),
							h('dt', null, t('dc.photos')), h('dd', null, String(docs.media.photos)),
							h('dt', null, t('dc.videos')), h('dd', null, String(docs.media.videos)),
							h('dt', null, t('dc.pdfletters')), h('dd', null, String(docs.media.pdfLetters)))),
					h(Card, { title: t('lc.bymonth'), note: letters.byMonth ? t('ui.months', { n: Object.keys(letters.byMonth).length }) : null },
						h(BarChart, { data: lastN(sortEntriesAsc(letters.byMonth || {}), 18), height: '74px' })),
					h(Card, { title: t('mt.bymonth') },
						h(BarChart, { data: lastN(sortEntriesAsc(meetings.byMonth || {}), 18), height: '74px', color: 'var(--epc-warn)' }))));
		}
