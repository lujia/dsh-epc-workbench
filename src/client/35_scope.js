		/* ============================ contract scope ============================ */
		/* A project workbench is read against one contract at a time: the main
		   contract with the employer, or one of the subcontract packages. The
		   vocabulary for that — which contracts exist, which letter series and
		   minute books belong to each, and what they are called — travels with the
		   dataset as `taxonomy`, so this file never names a particular project. */

		/* The currency the project is administered in. Every money tile prints it,
   so it belongs to the dataset rather than to the template. */
function ccyOf(data) {
    return (data && data.project && data.project.currency) || '';
}

function contractList(data) {
			return (data && data.contracts) || [];
		}

		function taxonomy(data) {
			return (data && data.taxonomy) || { contracts: [], letters: [], meetings: [] };
		}

		function contractById(data, id) {
			var list = contractList(data);
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].id === id) return list[i];
			}
			return list.length ? list[0] : null;
		}

		function scopeIds(data) {
			return contractList(data).map(function (c) { return c.id; });
		}

		/* The contract whose kind is 'main', or the first one when the project has
		   no main contract at all (a subcontract-only corpus is legitimate). */
		function mainScopeId(data) {
			var list = contractList(data);
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].kind === 'main') return list[i].id;
			}
			return list.length ? list[0].id : '';
		}

		function subScopeIds(data) {
			return contractList(data)
				.filter(function (c) { return c.kind !== 'main'; })
				.map(function (c) { return c.id; });
		}

		function isMainScope(data, id) {
			var c = contractById(data, id);
			return !!(c && c.kind === 'main');
		}

		/* Any unknown or stale scope id falls back to the main contract rather
		   than to an empty page. */
		function resolveScope(data, id) {
			if (id != null && scopeIds(data).indexOf(id) >= 0) return id;
			return mainScopeId(data);
		}

		function defaultScope(data) {
			return mainScopeId(data);
		}

		/* Letter series and minute books that belong to one contract. */
		function lettersFor(data, cid) {
			return taxonomy(data).letters.filter(function (s) { return s.contract === cid; });
		}

		function meetingsFor(data, cid) {
			return taxonomy(data).meetings.filter(function (s) { return s.contract === cid; });
		}

		function seriesKeysFor(data, cid) {
			return lettersFor(data, cid).map(function (s) { return s.key; });
		}

		function meetingKeysFor(data, cid) {
			return meetingsFor(data, cid).map(function (s) { return s.key; });
		}

		/* The token a document reference carries for this contract ('-P01-'),
		   or null when the references do not record it. */
		function contractTag(data, cid) {
			var c = contractById(data, cid);
			return c && c.tag ? '-' + c.tag + '-' : null;
		}

		function contractLabel(data, id) {
			var c = contractById(data, id);
			if (c && c.label) return c.label;
			return id || '';
		}

		function seriesLabel(data, key) {
			var list = taxonomy(data).letters;
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].key === key) return list[i].label || key;
			}
			return t('lc.series.' + key);
		}

		function seriesSide(data, key) {
			var list = taxonomy(data).letters;
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].key === key) return list[i].side || '';
			}
			return '';
		}

		function meetingLabel(data, key) {
			var list = taxonomy(data).meetings;
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].key === key) return list[i].label || key;
			}
			return key;
		}

		function useScope(props) {
			var fallback = props.scope != null ? props.scope : defaultScope(props.data);
			var [local, setLocal] = useState(fallback);
			var scope = props.scope != null ? props.scope : local;
			function choose(next) {
				if (typeof props.onScope === 'function') props.onScope(next);
				else setLocal(next);
			}
			return [scope, choose];
		}

		/* Records the dataset actually ties to a contract. Used for the small
		   counter under each register tile, so the tile never claims a figure the
		   data cannot back. */
		function scopeRecords(data, id) {
			if (!data) return null;
			var bySeries = (data.letters || {}).bySeries || {};
			var byPkg = (data.letters || {}).byPkg || {};
			var reg = contractById(data, id) || {};
			if (isMainScope(data, id)) {
				var sum = 0;
				seriesKeysFor(data, id).forEach(function (key) {
					sum += (bySeries[key] && bySeries[key].count) || 0;
				});
				var certs = data.mainContract && data.mainContract.totals
					? data.mainContract.totals.count
					: 0;
				return { letters: sum, certs: certs };
			}
			/* Subcontract certificates are not labelled by package in the letter
			   register, but each package keeps one retention row per certificate,
			   which is a faithful count of what has been certified. */
			return { letters: byPkg[id] || 0, certs: reg.records || 0 };
		}

		/* Two figures every main-contract progress reading needs, kept in one place
		   so the Overview band and the Commercial band cannot disagree:
		   - the cap is the revised contract price, because price adjustment is
		     certified on top of the original sum;
		   - the works valuation is the bill rows, which carry the temporary and
		     permanent works only — net certified also contains the price adjustment,
		     the import duty fee and the documents-against-acceptance charges, none of
		     which the contract price measures. */
		function mainCap(mc) {
			var c = (mc && mc.contract) || {};
			var v = c.revisedLkr != null ? c.revisedLkr : c.lkr;
			return isNum(v) && v > 0 ? v : null;
		}

		function mainWorks(mc) {
			var latest = (mc && mc.latest) || {};
			var bills = latest.bills || [];
			if (bills.length > 0) {
				var sum = 0;
				for (var i = 0; i < bills.length; i += 1) {
					if (isNum(bills[i].cumLkr)) sum += bills[i].cumLkr;
				}
				if (sum > 0) return sum;
			}
			return isNum(latest.grossCumLkr) && isNum(latest.adjustCumLkr)
				? latest.grossCumLkr - latest.adjustCumLkr
				: null;
		}

		/* The register strip: one tile per contract, the selected one carrying the
		   accent rule — selection is the only thing on the strip allowed to use the
		   accent colour. */
		function ContractBar(props) {
			var data = props.data;
			var list = contractList(data);
			if (list.length === 0) return null;

			return h('div', { className: 'epc-cbar' + (props.compact ? ' compact' : '') },
				list.map(function (c) {
					var on = c.id === props.scope;
					var recs = scopeRecords(data, c.id);
					return h('button', {
						key: c.id,
						className: 'epc-cbtn' + (on ? ' on' : ''),
						onClick: function () { props.onScope(c.id); },
						title: c.no
					},
						h('div', { className: 'epc-cbtn-top' },
							h('span', { className: 'epc-cbtn-role' }, c.label || c.id),
							h('span', { className: 'epc-cbtn-no mono' }, c.no)),
						h('div', { className: 'epc-cbtn-bot' },
							h('span', { className: 'epc-cbtn-party' },
								h('b', null, c.counterparty),
								c.counterpartyRole ? ' · ' + t('scope.' + c.counterpartyRole) : null),
							h('span', { className: 'epc-cbtn-val mono' }, compact(c.value) + ' ' + c.currency)),
						/* One meta line only: the tile already carries four pieces of
						   information and a second small line crowds the strip. */
						h('div', { className: 'epc-cbtn-rec' },
							[
								c.valueOrig != null && c.valueOrig !== c.value
									? t('scope.origvalue', { v: compact(c.valueOrig), c: c.currency || '' })
									: null,
								recs ? t('scope.rec', { l: grouped(recs.letters), c: grouped(recs.certs) }) : null
							].filter(function (s) { return s !== null; }).join(' · ')));
				}));
		}

		/* The parties the project is administered between, in the order the config
		   lists them: employer, contractor, subcontractor, or whatever a given
		   project actually has. */
		function partyList(data) {
			return (taxonomy(data).parties || []);
		}

		/* Minute books per contract, as a one-line caption. Kept generic because a
		   project may keep one book, three, or none for a given contract. */
		function meetingSummary(data) {
			var bySeries = (data && data.meetings && data.meetings.bySeries) || {};
			var books = taxonomy(data).meetings;
			var parts = books
				.map(function (b) { return bySeries[b.key] ? (b.label || b.key) + ' ' + grouped(bySeries[b.key].count) : null; })
				.filter(function (s) { return s !== null; });
			return parts.length ? parts.join(' · ') : '—';
		}

		/* The payment direction of a contract as a single caption: who certifies
		   and who pays. Both sides come from the register, so the caption survives
		   a project whose parties have nothing to do with this one. */
		function scopeFlow(data, id) {
			var c = contractById(data, id);
			if (!c) return '';
			if (c.issuer && c.counterparty) return c.issuer + ' → ' + c.counterparty;
			return c.no || '';
		}

		/* Party block shared by Overview and the register card: every party is
		   shown with the name it trades under today plus the one it used before
		   the rename, because both names appear in the underlying records. */
		function PartyRow(props) {
			return h('div', { className: 'epc-party' },
				h('span', { className: 'epc-party-role' }, props.role),
				h('span', { className: 'epc-party-name' }, props.name),
				props.former ? h('span', { className: 'epc-party-former' }, t('scope.formerly', { name: props.former })) : null);
		}
