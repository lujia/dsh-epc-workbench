/* ============================================================================
   Subject folders — one page per folder of the project

   The project is organised as ten folders: contracts, defects, drawings,
   letters, materials, meetings, payments, photos, taking-overs and videos. Eight
   of them already feed a section of their own, and those sections are the right
   way to read the records inside them — a certificate is not a file listing.

   A folder page answers the other question: what is in this folder. It lists
   every file it holds with its size, its format and where it sits, groups them
   by subfolder, and shows the formats as bars, so a reader can see whether a
   folder is one big register or nine hundred drawings across twenty sets
   without opening the file system. The listing is bounded by the extractor
   (600 files, 900 for drawings) and the page says so when it is — a page that
   claims a folder holds 600 files when it holds 7,596 is worse than no page.
   ============================================================================ */

		/* The ten folders, in the order the project names them. Kept here rather
		   than read from the payload so a page renders even when the folder is
		   absent: an empty folder is a fact about the project, and the page that
		   says 'this folder holds nothing' is how the reader learns it. */
		var FOLDER_KEYS = [
			'contracts', 'defects', 'drawings', 'letters', 'materials',
			'meetings', 'payments', 'photos', 'taking_overs', 'videos'
		];

		function folderOf(data, key) {
			var f = ((data && data.folders) || {})[key];
			return f || { dir: null, files: [], count: 0, shown: 0, others: 0, capped: false };
		}

		function folderCount(data, key) {
			return folderOf(data, key).count || 0;
		}

		/* Format of a file as a word rather than an extension where the extension
		   says less than the thing: a .dwg and a .pdf in a drawings folder are both
		   drawings, and a reader scans 'CAD 351' faster than 'dwg 351, dwf 12'. */
		function formatOf(ext) {
			var e = String(ext || '').toLowerCase();
			if (e === 'pdf') return 'PDF';
			if (e === 'dwg' || e === 'dwf' || e === 'dxf' || e === 'plt' || e === 'ctb') return 'CAD';
			if (e === 'md' || e === 'txt') return 'Text';
			if (e === 'doc' || e === 'docx') return 'Word';
			if (e === 'xls' || e === 'xlsx' || e === 'xlsm') return 'Excel';
			if (e === 'jpg' || e === 'jpeg' || e === 'png' || e === 'tif' || e === 'tiff' || e === 'bmp' || e === 'heic') return 'Image';
			if (e === 'mp4' || e === 'mov' || e === 'avi' || e === 'mkv' || e === 'wmv' || e === 'm4v') return 'Video';
			return e ? e.toUpperCase() : 'File';
		}

		function folderBytes(n) {
			if (!isNum(n) || n <= 0) return '—';
			var units = ['B', 'KB', 'MB', 'GB', 'TB'];
			var i = 0;
			var v = n;
			while (v >= 1024 && i < units.length - 1) { v = v / 1024; i += 1; }
			return (i === 0 ? v.toFixed(0) : v.toFixed(v >= 100 ? 0 : 1)) + ' ' + units[i];
		}

		function folderStats(files) {
			var formats = {};
			var subs = {};
			var total = 0;
			(files || []).forEach(function (f) {
				var k = formatOf(f.ext);
				formats[k] = (formats[k] || 0) + 1;
				var s = f.sub || '';
				subs[s] = (subs[s] || 0) + 1;
				total += f.size || 0;
			});
			return { formats: formats, subs: subs, total: total };
		}

		function FolderHead(props) {
			var f = props.folder;
			var stats = props.stats;
			var shownSub = f.capped
				? t('fd.shown', { n: grouped(f.shown) })
				: (f.count === 0 ? t('fd.empty') : t('fd.all'));
			return h(KpiRow, {
				items: [
					{ label: t('fd.files'), value: grouped(f.count), sub: shownSub },
					{
						label: t('fd.folders'),
						value: grouped(Object.keys(stats.subs).length),
						sub: t('fd.subfolders')
					},
					{
						label: t('fd.formats'),
						value: grouped(Object.keys(stats.formats).length),
						sub: topEntries(stats.formats, 2).map(function (e) { return e[0] + ' ' + grouped(e[1]); }).join(' · ')
					},
					{ label: t('fd.size'), value: folderBytes(stats.total), sub: t('fd.size.note') }
				]
			});
		}

		/* Grouped by subfolder, because a drawings folder of nine hundred files is
		   nine hundred rows of noise in file-system order and twenty readable groups
		   in the order the project filed them. */
		function FileGroups(props) {
			var rows = props.files || [];
			if (rows.length === 0) return null;
			var groups = [];
			var index = {};
			rows.forEach(function (f) {
				var sub = f.sub || '';
				if (!Object.prototype.hasOwnProperty.call(index, sub)) {
					index[sub] = groups.length;
					groups.push({ sub: sub, files: [] });
				}
				groups[index[sub]].files.push(f);
			});
			return h('div', { className: 'epc-files' }, groups.map(function (g, gi) {
				return h('div', { className: 'epc-filegroup', key: 'g' + gi },
					h('div', { className: 'epc-filegroup-h' },
						h('span', { className: 'epc-filegroup-n' }, g.sub || t('fd.root')),
						h('span', { className: 'epc-filegroup-c' }, t('fd.group', { n: grouped(g.files.length) }))),
					h('table', { className: 'epc-table' },
						h('thead', null, h('tr', null,
							h('th', null, t('fd.th.name')),
							h('th', { className: 'r', style: { width: '92px' } }, t('fd.th.size')),
							h('th', { style: { width: '86px' } }, t('fd.th.format')))),
						h('tbody', null, g.files.map(function (f, fi) {
							return h('tr', { key: 'r' + fi },
								h('td', null,
									h('div', { className: 'epc-clip', style: { maxWidth: '560px' }, title: f.rel || f.name }, f.name)),
								h('td', { className: 'r mono dim' }, folderBytes(f.size)),
								h('td', null, h(Pill, { dot: false }, formatOf(f.ext))));
						}))));
			}));
		}

		function ViewFolder(props) {
			var data = props.data;
			var key = props.folderKey;
			var folder = folderOf(data, key);
			var stats = folderStats(folder.files);
			var formats = toEntries(stats.formats).sort(function (a, b) { return b[1] - a[1]; });
			var subs = toEntries(stats.subs).sort(function (a, b) { return b[1] - a[1]; });
			var maxFormat = formats.length > 0 ? formats[0][1] : 1;
			var maxSub = subs.length > 0 ? subs[0][1] : 1;

			return h('div', { className: 'epc-wrap' },
				h(PageHead, {
					title: t('view.f_' + key),
					sub: folder.dir
						? t('fd.head', { dir: folder.dir, n: grouped(folder.count) })
						: t('fd.head.none', { dir: key })
				}),
				h(FolderHead, { folder: folder, stats: stats }),
				formats.length > 0 ? h('div', { className: 'epc-grid epc-g2' },
					h(Card, { title: t('fd.formats.title'), note: t('fd.formats.note') },
						formats.slice(0, 8).map(function (e, i) {
							return h(ListBar, {
								key: 'f' + i,
								label: e[0],
								value: e[1],
								max: maxFormat,
								display: grouped(e[1])
							});
						})),
					h(Card, { title: t('fd.subs.title'), note: t('fd.subs.note') },
						subs.slice(0, 12).map(function (e, i) {
							return h(ListBar, {
								key: 's' + i,
								label: e[0] === '' ? t('fd.root') : e[0],
								value: e[1],
								max: maxSub,
								display: grouped(e[1])
							});
						}))) : null,
				folder.count === 0
					/* An empty folder is not always an empty folder: a videos folder
					   holding four documents and no video is a fact about the project,
					   and saying 'nothing here' beside a note that four files are not
					   listed would read as a contradiction. */
					? h(Card, null, h(Empty, null,
						h('div', null, folder.others > 0 ? t('fd.empty.others.title') : t('fd.empty.title')),
						h('div', { className: 'epc-dim', style: { marginTop: '6px' } },
							folder.others > 0
								? t('fd.empty.others', { n: grouped(folder.others), dir: folder.dir || key })
								: t('fd.empty.hint', { dir: folder.dir || key }))))
					: h(Card, {
						title: t('fd.list.title'),
						note: folder.capped ? t('fd.list.capped', { n: grouped(folder.shown) }) : t('fd.list.note')
					}, h(FileGroups, { files: folder.files })),
				folder.others > 0
					? h('div', { className: 'epc-note' }, t('fd.others', { n: grouped(folder.others) }))
					: null);
		}
