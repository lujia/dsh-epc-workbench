window.__ModuleLoader__.load({
	id: 'dsh-epc-workbench',
	factory: function (require) {
		var React = require('react');
		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;
		var useMemo = React.useMemo;
		var useRef = React.useRef;
		var useCallback = React.useCallback;

		var PANEL_ID = 'epc-workbench';
		var NAMESPACE = 'plugin.epc-workbench';
		var ROUTE_PREFIX = '/plugins/epc-workbench';
		var DATA_URL = ROUTE_PREFIX + '/data';
		var INDEX_URL = ROUTE_PREFIX + '/index';
		var STATE_URL = ROUTE_PREFIX + '/state';
		var FOLDER_URL = ROUTE_PREFIX + '/folder';
		var RESET_URL = ROUTE_PREFIX + '/reset';

		var CSS = String.raw`
.epc-root{
  --epc-bg: var(--dsw-alias-bg-base,#1e1f22);
  --epc-panel: var(--dsw-alias-bg-layer-1,#2b2d31);
  --epc-panel2: var(--dsw-alias-bg-layer-2,#25272b);
  --epc-text: var(--dsw-alias-label-primary,#e7e7e7);
  --epc-muted: var(--dsw-alias-label-secondary,#9aa0a6);
  --epc-dim: var(--dsw-alias-label-tertiary,color-mix(in oklab,var(--dsw-alias-label-secondary,#9aa0a6) 80%,transparent));
  --epc-line: var(--dsw-alias-border-l1,#16171a);
  --epc-line2: var(--dsw-alias-border-l2,#3a3d44);
  --epc-accent: var(--dsw-alias-brand-primary,#4a8cff);
  --epc-soft: var(--dsw-alias-accent-soft,color-mix(in oklab,var(--dsw-alias-brand-primary,#4a8cff) 20%,transparent));
  --epc-good: var(--dsw-alias-state-success-primary,#33d17a);
  --epc-warn: var(--dsw-alias-state-warn-primary,#ffd479);
  --epc-crit: var(--dsw-alias-state-error-primary,#e2554a);
  /* Neutral states are mixed from the label colour so they invert with the theme. */
  --epc-hover: var(--dsw-alias-interactive-bg-hover,color-mix(in oklab,var(--dsw-alias-label-primary,#e7e7e7) 9%,transparent));
  --epc-control: var(--dsw-alias-bg-layer-3,color-mix(in oklab,var(--dsw-alias-label-primary,#e7e7e7) 7%,var(--dsw-alias-bg-layer-2,#25272b)));
  --epc-mono: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  position:relative;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;
  background:var(--epc-bg);color:var(--epc-text);font-size:13px;line-height:1.45;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.epc-root *,.epc-root *::before,.epc-root *::after{box-sizing:border-box}
.epc-root :where(button,a[href],input,select,textarea,[tabindex]):focus-visible{outline:2px solid var(--epc-accent);outline-offset:2px;border-radius:3px}
.epc-root ::-webkit-scrollbar{width:10px;height:10px}
.epc-root ::-webkit-scrollbar-thumb{background:var(--epc-line2);border-radius:6px;border:2px solid transparent;background-clip:content-box}
.epc-root ::-webkit-scrollbar-track{background:transparent}

/* ---------- topbar ---------- */
.epc-top{display:flex;align-items:center;gap:10px;min-height:46px;padding:0 12px;background:var(--epc-panel);border-bottom:1px solid var(--epc-line);flex:none}
.epc-mark{display:flex;align-items:center;gap:8px;padding-right:10px;margin-right:2px;border-right:1px solid var(--epc-line2);height:28px;flex:none}
.epc-mark-glyph{width:22px;height:22px;border-radius:5px;background:var(--epc-accent);color:#fff;display:grid;place-items:center;font:700 11px/1 var(--epc-mono);letter-spacing:.02em}
.epc-mark-name{font-weight:650;letter-spacing:.01em;white-space:nowrap}
.epc-mark-sub{font-size:10.5px;color:var(--epc-dim);text-transform:uppercase;letter-spacing:.09em;white-space:nowrap}
.epc-crumbs{display:flex;align-items:center;gap:7px;color:var(--epc-muted);font-size:12px;min-width:0}
.epc-crumbs b{color:var(--epc-text);font-weight:600}
.epc-crumb-sep{color:var(--epc-dim)}
.epc-top-spacer{flex:1 1 auto}
.epc-seg{display:inline-flex;background:var(--epc-panel2);border:1px solid var(--epc-line2);border-radius:7px;padding:2px;gap:2px}
.epc-seg button{appearance:none;border:0;background:transparent;color:var(--epc-muted);font:inherit;font-size:11.5px;padding:4px 9px;border-radius:5px;cursor:pointer;white-space:nowrap}
.epc-seg button:hover{background:var(--epc-hover);color:var(--epc-text)}
.epc-seg button.on{background:var(--epc-accent);color:#fff}
.epc-kbd{font:600 10.5px/1 var(--epc-mono);color:var(--epc-muted);border:1px solid var(--epc-line2);border-bottom-width:2px;border-radius:5px;padding:3px 5px;background:var(--epc-panel2)}
.epc-iconbtn{appearance:none;border:1px solid transparent;background:transparent;color:var(--epc-muted);width:28px;height:28px;border-radius:6px;display:grid;place-items:center;cursor:pointer;flex:none}
.epc-iconbtn:hover{background:var(--epc-hover);color:var(--epc-text)}
.epc-searchbtn{display:flex;align-items:center;gap:8px;appearance:none;border:1px solid var(--epc-line2);background:var(--epc-panel2);color:var(--epc-dim);border-radius:7px;padding:5px 8px;min-width:210px;font:inherit;font-size:12px;cursor:pointer}
.epc-searchbtn:hover{border-color:var(--epc-accent);color:var(--epc-muted)}

/* ---------- body / rail ---------- */
.epc-body{flex:1 1 auto;display:flex;min-height:0}
.epc-rail{width:196px;flex:none;background:var(--epc-panel2);border-right:1px solid var(--epc-line);padding:10px 8px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;transition:width .12s ease}
.epc-rail.mini{width:50px;padding-left:6px;padding-right:6px}
.epc-cluster{font:600 9.5px/1 var(--epc-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--epc-dim);padding:12px 8px 6px}
.epc-rail.mini .epc-cluster{text-align:center;padding:12px 0 6px;font-size:8px;letter-spacing:.05em}
.epc-navitem{display:flex;align-items:center;gap:9px;appearance:none;border:0;background:transparent;color:var(--epc-muted);font:inherit;font-size:12.5px;text-align:left;padding:6px 8px;border-radius:7px;cursor:pointer;width:100%;min-height:32px}
.epc-navitem:hover{background:var(--epc-hover);color:var(--epc-text)}
.epc-navitem.on{background:var(--epc-accent);color:#fff}
.epc-navitem.on .epc-navmeta{color:rgba(255,255,255,.8)}
.epc-navglyph{width:18px;height:18px;flex:none;display:grid;place-items:center;opacity:.95}
.epc-navlabel{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.epc-rail.mini .epc-navlabel,.epc-rail.mini .epc-navmeta{display:none}
.epc-navmeta{font:500 10.5px/1 var(--epc-mono);color:var(--epc-dim);background:transparent;padding:2px 0 0}
.epc-badge{font:600 9.5px/1 var(--epc-mono);padding:3px 5px;border-radius:99px;background:var(--epc-crit);color:#fff;flex:none}
.epc-railtoggle{margin-top:auto;padding-top:8px;border-top:1px solid var(--epc-line2)}

/* ---------- stage ---------- */
.epc-stage{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:hidden;background:var(--epc-bg)}
.epc-scroll{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:20px 24px 40px}
.epc-wrap{max-width:1360px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.epc-head{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;padding-bottom:2px}
.epc-head-t{min-width:0}
.epc-h1{font-size:20px;font-weight:650;letter-spacing:-.01em;margin:0;display:flex;align-items:center;gap:9px}
.epc-sub{color:var(--epc-muted);font-size:12.5px;margin-top:3px}
.epc-head-actions{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* ---------- cards / grid ---------- */
.epc-grid{display:grid;gap:12px}
.epc-g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.epc-g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.epc-g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.epc-g23{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)}
.epc-g32{grid-template-columns:minmax(0,1fr) minmax(0,1.55fr)}
@media (max-width:1180px){.epc-g4{grid-template-columns:repeat(2,minmax(0,1fr))}.epc-g3{grid-template-columns:repeat(2,minmax(0,1fr))}.epc-g23,.epc-g32{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){.epc-g2,.epc-g3,.epc-g4{grid-template-columns:minmax(0,1fr)}}
.epc-card{background:var(--epc-panel);border:1px solid var(--epc-line);border-radius:10px;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.epc-card-h{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--epc-line);flex:none}
.epc-card-t{font-size:12.5px;font-weight:600;letter-spacing:.005em}
.epc-card-note{font-size:11px;color:var(--epc-dim);margin-left:auto;white-space:nowrap}
.epc-card-b{padding:12px 14px;min-width:0}
.epc-card-b.flush{padding:0}
.epc-card-b.fill{flex:1 1 auto;overflow:auto}

/* ---------- kpi ---------- */
.epc-kpi{background:var(--epc-panel);border:1px solid var(--epc-line);border-radius:10px;padding:11px 13px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
.epc-kpi-k{font:600 9.5px/1 var(--epc-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--epc-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.epc-kpi-v{font:650 21px/1.15 var(--epc-mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em;display:flex;align-items:baseline;gap:4px}
.epc-kpi-u{font:500 11px/1 var(--epc-mono);color:var(--epc-muted);letter-spacing:0}
.epc-kpi-m{display:flex;flex-direction:column;gap:1px;margin-top:-1px}
.epc-kpi-ml{font:600 12.5px/1.25 var(--epc-mono);font-variant-numeric:tabular-nums;letter-spacing:-.01em;display:flex;align-items:baseline;gap:4px;color:var(--epc-text)}
.epc-kpi-ml .epc-kpi-u{font-size:10px}
.epc-kpi-s{font-size:11px;color:var(--epc-muted);display:flex;align-items:center;gap:6px;min-height:15px}
.epc-trend{font:600 10.5px/1 var(--epc-mono);padding:2px 5px;border-radius:4px;background:var(--epc-hover)}
.epc-trend.up{color:var(--epc-crit)}
.epc-trend.down{color:var(--epc-good)}

/* ---------- pills / tags ---------- */
.epc-pill{display:inline-flex;align-items:center;gap:5px;font:600 10px/1 var(--epc-mono);letter-spacing:.03em;padding:3px 6px;border-radius:5px;background:var(--epc-hover);color:var(--epc-muted);white-space:nowrap}
.epc-pill.good{background:color-mix(in srgb,var(--epc-good) 18%,transparent);color:var(--epc-good)}
.epc-pill.warn{background:color-mix(in srgb,var(--epc-warn) 18%,transparent);color:var(--epc-warn)}
.epc-pill.crit{background:color-mix(in srgb,var(--epc-crit) 18%,transparent);color:var(--epc-crit)}
.epc-pill.acc{background:var(--epc-soft);color:var(--epc-accent)}
.epc-dot{width:6px;height:6px;border-radius:99px;background:currentColor;flex:none}

/* ---------- bars / charts ---------- */
.epc-bars{display:flex;align-items:flex-end;gap:2px;height:110px;padding-top:4px}
.epc-bar{flex:1 1 0;min-width:2px;background:var(--epc-accent);border-radius:2px 2px 0 0;position:relative;opacity:.85;transition:opacity .1s}
.epc-bar:hover{opacity:1}
.epc-bars-axis{display:flex;justify-content:space-between;font:500 10px/1 var(--epc-mono);color:var(--epc-dim);margin-top:6px}
.epc-lbars{display:flex;flex-direction:column;gap:6px}
.epc-lbar{display:grid;grid-template-columns:minmax(84px,1.1fr) minmax(0,2.4fr) auto;gap:10px;align-items:center;font-size:11.5px}
.epc-lbar-k{color:var(--epc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.epc-lbar-track{height:7px;border-radius:99px;background:var(--epc-panel2);overflow:hidden}
.epc-lbar-fill{height:100%;border-radius:99px;background:var(--epc-accent);min-width:2px}
.epc-lbar-n{font:600 11px/1 var(--epc-mono);color:var(--epc-text);font-variant-numeric:tabular-nums;min-width:44px;text-align:right}
.epc-prog{height:8px;border-radius:99px;background:var(--epc-panel2);overflow:hidden;display:flex}
.epc-prog>i{height:100%;display:block}
.epc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--epc-muted);margin-top:9px}
.epc-legend span{display:inline-flex;align-items:center;gap:5px}
.epc-swatch{width:8px;height:8px;border-radius:2px;flex:none}

/* ---------- tables ---------- */
.epc-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
.epc-tbl thead th{position:sticky;top:0;background:var(--epc-panel);z-index:1;text-align:left;font:600 9.5px/1 var(--epc-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--epc-dim);padding:9px 12px;border-bottom:1px solid var(--epc-line);white-space:nowrap}
.epc-tbl tbody td{padding:7px 12px;border-bottom:1px solid var(--epc-line);vertical-align:top;color:var(--epc-text)}
.epc-tbl tbody tr:hover td{background:var(--epc-hover)}
.epc-tbl tbody tr:last-child td{border-bottom:0}
.epc-tbl .r{text-align:right;font-variant-numeric:tabular-nums}
.epc-tbl .mono{font-family:var(--epc-mono);font-size:11.5px;letter-spacing:-.01em}
.epc-tbl .dim{color:var(--epc-muted)}
.epc-clip{max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.epc-clip:hover{white-space:normal}
.epc-empty{padding:26px 14px;text-align:center;color:var(--epc-dim);font-size:12px}

/* ---------- filters ---------- */
.epc-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--epc-line);background:var(--epc-panel)}
.epc-input,.epc-select{appearance:none;background:var(--epc-panel2);border:1px solid var(--epc-line2);color:var(--epc-text);font:inherit;font-size:12px;border-radius:6px;padding:5px 8px;min-height:28px}
.epc-input::placeholder{color:var(--epc-dim)}
.epc-input:focus,.epc-select:focus{border-color:var(--epc-accent)}
.epc-select{cursor:pointer;padding-right:22px;background-image:linear-gradient(45deg,transparent 50%,var(--epc-muted) 50%),linear-gradient(135deg,var(--epc-muted) 50%,transparent 50%);background-position:calc(100% - 12px) 12px,calc(100% - 8px) 12px;background-size:4px 4px,4px 4px;background-repeat:no-repeat}
.epc-chip{appearance:none;border:1px solid var(--epc-line2);background:var(--epc-panel2);color:var(--epc-muted);font:inherit;font-size:11.5px;border-radius:99px;padding:4px 9px;cursor:pointer;white-space:nowrap}
.epc-chip:hover{background:var(--epc-hover);color:var(--epc-text)}
.epc-chip.on{background:var(--epc-accent);border-color:var(--epc-accent);color:#fff}
.epc-filter-count{margin-left:auto;font:500 11px/1 var(--epc-mono);color:var(--epc-dim);white-space:nowrap}
.epc-btn{appearance:none;border:1px solid var(--epc-line2);background:var(--epc-control);color:var(--epc-text);font:inherit;font-size:12px;border-radius:6px;padding:5px 10px;cursor:pointer;white-space:nowrap}
.epc-btn:hover{background:var(--epc-hover);border-color:var(--epc-accent)}
.epc-btn.primary{background:var(--epc-accent);border-color:var(--epc-accent);color:#fff;font-weight:600}
.epc-btn.primary:hover{filter:brightness(1.08)}

/* ---------- misc ---------- */
.epc-kv{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:12px}
.epc-kv dt{color:var(--epc-dim);white-space:nowrap;font-size:11.5px}
.epc-kv dd{margin:0;color:var(--epc-text);min-width:0;overflow-wrap:anywhere}
.epc-mono{font-family:var(--epc-mono);font-variant-numeric:tabular-nums}
.epc-splitline{display:flex;align-items:center;gap:10px;color:var(--epc-dim);font:500 10px/1 var(--epc-mono);letter-spacing:.1em;text-transform:uppercase;margin:2px 0}
.epc-splitline::after{content:"";flex:1 1 auto;height:1px;background:var(--epc-line2)}
.epc-loading{display:grid;place-items:center;gap:10px;padding:60px;color:var(--epc-muted);font-size:12.5px}
.epc-spin{width:20px;height:20px;border:2px solid var(--epc-line2);border-top-color:var(--epc-accent);border-radius:99px;animation:epc-spin .7s linear infinite}
@keyframes epc-spin{to{transform:rotate(360deg)}}
.epc-err{margin:24px;padding:14px 16px;border:1px solid var(--epc-crit);border-radius:8px;background:color-mix(in srgb,var(--epc-crit) 10%,transparent);color:var(--epc-text);font-size:12.5px}
.epc-err code{font-family:var(--epc-mono);color:var(--epc-crit)}
.epc-note{font-size:11.5px;color:var(--epc-dim);padding:8px 14px;border-top:1px solid var(--epc-line);background:var(--epc-panel2)}

/* ---------- project folder strip ---------- */
.epc-sourcebar{flex:none;padding:10px 24px 0;background:var(--epc-bg)}
.epc-src{display:flex;align-items:center;gap:9px;min-height:32px;padding:5px 10px;border:1px solid var(--epc-line2);border-radius:7px;background:var(--epc-panel2);font-size:11.5px;color:var(--epc-muted);min-width:0}
.epc-src.on{border-color:color-mix(in srgb,var(--epc-accent) 45%,var(--epc-line2));background:color-mix(in srgb,var(--epc-accent) 8%,var(--epc-panel2))}
.epc-src-k{font:600 9.5px/1 var(--epc-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--epc-dim);flex:none}
.epc-src-v{display:flex;align-items:baseline;gap:8px;min-width:0}
.epc-src-name{color:var(--epc-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.epc-src-when{font:500 10.5px/1 var(--epc-mono);color:var(--epc-dim);white-space:nowrap}
.epc-src-busy{display:flex;align-items:center;gap:6px;color:var(--epc-accent);font-weight:600;white-space:nowrap}
.epc-src-busy .epc-dot{animation:epc-pulse 1.1s ease-in-out infinite}
.epc-src-err{color:var(--epc-crit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38ch}
.epc-src .grow{flex:1 1 auto}
.epc-wait{display:flex;flex-direction:column;gap:7px;align-items:flex-start;padding:36px 30px;margin:8px 0 0;border:1px solid var(--epc-line2);border-radius:8px;background:var(--epc-panel2)}
.epc-wait-k{font-weight:650;font-size:13px;color:var(--epc-text);display:flex;align-items:center;gap:8px}
.epc-wait-k::after{content:"";width:9px;height:9px;border-radius:99px;background:var(--epc-accent);animation:epc-pulse 1.1s ease-in-out infinite}
.epc-wait-l{font:500 11px/1.5 var(--epc-mono);color:var(--epc-dim);white-space:pre-wrap;word-break:break-word;max-width:70ch}
@keyframes epc-pulse{0%,100%{opacity:1}50%{opacity:.25}}
.epc-sectlabel{display:flex;align-items:center;gap:10px;color:var(--epc-dim);font:600 9.5px/1 var(--epc-mono);letter-spacing:.12em;text-transform:uppercase;margin:6px 0 -4px}
.epc-sectlabel::after{content:"";flex:1 1 auto;height:1px;background:var(--epc-line2)}

/* ---------- contract register strip ---------- */
.epc-cbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--epc-line);border:1px solid var(--epc-line);border-radius:8px;overflow:hidden}
.epc-cbar.compact{grid-template-columns:repeat(3,minmax(0,1fr))}
.epc-cbtn{appearance:none;text-align:left;display:flex;flex-direction:column;gap:3px;padding:9px 12px 10px;border:0;border-left:3px solid transparent;background:var(--epc-panel2);color:var(--epc-text);font:inherit;cursor:pointer;min-width:0}
.epc-cbtn:hover{background:var(--epc-hover)}
.epc-cbtn.on{background:var(--epc-panel);border-left-color:var(--epc-accent)}
.epc-cbtn-top{display:flex;align-items:baseline;gap:8px;min-width:0}
.epc-cbtn-role{font-size:11.5px;font-weight:650;white-space:nowrap}
.epc-cbtn.on .epc-cbtn-role{color:var(--epc-accent)}
.epc-cbtn-no{font-size:10px;color:var(--epc-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.epc-cbtn-bot{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}
.epc-cbtn-party{font-size:10.5px;color:var(--epc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.epc-cbtn-party b{color:var(--epc-text);font-weight:600}
.epc-cbtn-val{font-size:10.5px;color:var(--epc-muted);white-space:nowrap}
.epc-cbtn.on .epc-cbtn-val{color:var(--epc-text)}
.epc-cbtn-rec{font:500 9.5px/1 var(--epc-mono);letter-spacing:.04em;color:var(--epc-dim);text-transform:uppercase}
.epc-party{display:flex;flex-direction:column;gap:1px;padding:5px 0;min-width:0}
.epc-party+.epc-party{border-top:1px solid var(--epc-line)}
.epc-party-role{font:600 9.5px/1.4 var(--epc-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--epc-dim)}
.epc-party-name{font-size:12px;color:var(--epc-text);overflow-wrap:anywhere}
.epc-party-former{font-size:10.5px;color:var(--epc-dim);overflow-wrap:anywhere}

/* ---------- statusbar ---------- */
.epc-status{height:26px;flex:none;display:flex;align-items:center;gap:14px;padding:0 12px;background:var(--epc-panel2);border-top:1px solid var(--epc-line);font:500 10.5px/1 var(--epc-mono);color:var(--epc-dim);letter-spacing:.02em;overflow:hidden}
.epc-status em{font-style:normal;color:var(--epc-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.epc-status>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.epc-status-r{display:flex;align-items:center;gap:14px;flex:0 1 auto;min-width:0}
.epc-status .grow{flex:1 1 auto;min-width:12px}
.epc-live{display:inline-flex;align-items:center;gap:5px;color:var(--epc-good)}

/* ---------- command palette ---------- */
.epc-pal-mask{position:absolute;inset:0;background:rgba(0,0,0,.44);display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;z-index:40;backdrop-filter:blur(1.5px)}
.epc-pal{width:min(720px,92vw);max-height:66vh;display:flex;flex-direction:column;background:var(--epc-panel);border:1px solid var(--epc-line2);border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.5);overflow:hidden}
.epc-pal-in{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--epc-line)}
.epc-pal-in input{flex:1 1 auto;appearance:none;border:0;background:transparent;color:var(--epc-text);font:inherit;font-size:14px;outline:none}
.epc-pal-list{overflow-y:auto;padding:6px}
.epc-pal-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:7px 9px;border-radius:7px;cursor:pointer;font-size:12.5px}
.epc-pal-row:hover,.epc-pal-row.sel{background:var(--epc-soft)}
.epc-pal-k{font:600 9.5px/1 var(--epc-mono);letter-spacing:.08em;color:var(--epc-dim);border:1px solid var(--epc-line2);border-radius:4px;padding:3px 5px;text-transform:uppercase}
.epc-pal-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--epc-text)}
.epc-pal-d{font:500 10.5px/1 var(--epc-mono);color:var(--epc-dim);white-space:nowrap}
.epc-pal-f{padding:7px 14px;border-top:1px solid var(--epc-line);font:500 10.5px/1 var(--epc-mono);color:var(--epc-dim);display:flex;gap:14px;background:var(--epc-panel2)}
`;

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

		/* Reading a different project folder replaces both files, so the cached
		   parse has to go as well — otherwise the page that says it is showing the
		   new folder would still be rendering the old one. */
		function resetData() {
			DATA_CACHE = null;
			DATA_PROMISE = null;
			INDEX_CACHE = null;
			INDEX_PROMISE = null;
		}

		function postJson(url, body) {
			return fetch(url, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body || {}),
			}).then(function (res) {
				return res.json().catch(function () { return {}; }).then(function (json) {
					if (!res.ok) {
						throw new Error((json && json.message) || ('HTTP ' + res.status + ' — ' + url));
					}
					return json;
				});
			});
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

		/* ============================ locale ============================ */
		var EN = {
			'meta.title': 'EPC Project Workbench',
			'meta.description': 'Project controls for an EPC contract — progress, payments, correspondence, meetings, defects and documents.',
			'nav.panel': 'EPC Workbench',
			'app.loading': 'Loading project data…',
			'app.error': 'Could not load the project dataset.',
			'app.retry': 'Retry',
			'cluster.project': 'Project',
			'cluster.delivery': 'Delivery',
			'cluster.records': 'Records',
			'view.overview': 'Overview',
			'view.commercial': 'Commercial',
			'view.correspondence': 'Correspondence',
			'view.meetings': 'Meetings',
			'view.quality': 'Quality & Defects',
			'view.documents': 'Documents',
			'action.search': 'Search everything',
			'action.back': 'Back to conversation',
			'action.collapse': 'Collapse rail',
			'action.expand': 'Expand rail',
			'action.all': 'All',
			'action.reset': 'Reset',
			'seg.p01': 'Package 1',
			'seg.p02': 'Package 2',
			'seg.main': 'Main contract',
			'seg.both': 'Both packages',
			'ov.title': 'Project overview',
			'ov.sub': '{name} · {site}',
			'ov.kpi.contract': 'Combined contract value',
			'ov.kpi.paid': 'Paid to subcontractor',
			'ov.kpi.letters': 'Letters on record',
			'ov.kpi.defects': 'Open defects',
			'ov.kpi.certified': 'Certified to date',
			'ov.kpi.overdue': 'Overdue defects',
			'ov.kpi.meetings': 'Meeting minutes',
			'ov.kpi.unpaid': 'Certified but unpaid',
			'ov.cert.title': 'Latest interim payment certificate',
			'ov.cert.note': 'IPC {no} · period {period}',
			'ov.cert.previous': 'Certified up to previous',
			'ov.cert.current': 'This certificate',
			'ov.cert.cumulative': 'Cumulative certified',
			'ov.cert.retention': 'Retention withheld',
			'ov.cert.advance': 'Advance recovered',
			'ov.cert.net': 'Net payable',
			'ov.cert.ofvalue': '{p} of contract value',
			'ov.cert.ofrevised': '{p} of the revised contract price',
			'ov.cert.workrevised': 'works executed, {p} of the revised contract price',
			'ov.party.employer': 'Employer',
			'ov.party.contractor': 'Contractor',
			'ov.party.subcontractor': 'Subcontractor',
			'ov.party.epc': 'EPC contract',
			'ov.party.p02': 'Second package contract',
			'ov.party.p01value': 'First package value',
			'ov.party.p02value': 'Second package value',
			'ov.party.mainprice': 'Main price',
			'ov.flow.title': 'Correspondence volume',
			'ov.flow.note': 'letters per month',
			'ov.flow.note.main': 'certified to the employer, by month',
			'ov.flow.title2': 'Payments released',
			'ov.flow.note2': 'to subcontractor, by month',
			'ov.flow.note3': 'invoice → receipt from the employer',
			'ov.contract.title': 'Contract participants',
			'ov.grade.title': 'Defects by severity',
			'ov.grade.note': 'open items only',
			'ov.disc.title': 'Defects by discipline',
			'ov.pkg.title': 'Letter packages',
			'ov.recent.title': 'Recent correspondence',
			'ov.recent.note': 'latest 12 items',
			'ov.milestone.title': 'Key records',
			'co.title': 'Commercial',
			'co.sub': 'Interim payment certificates, retention and cash position',
			'co.tab.ipcs': 'Payment certificates',
			'co.tab.employer': 'Receipts from employer',
			'co.tab.retention': 'Retention & advance',
			'co.tab.boq': 'Certificate breakdown',
			'co.kpi.certified': 'Certified (subcontract)',
			'co.kpi.certified.all': 'Certified (all packages)',
			'co.kpi.paid': 'Paid (subcontract)',
			'co.kpi.invoiced': 'Invoiced to employer',
			'co.kpi.received': 'Received from employer',
			'co.kpi.unpaid': 'Awaiting payment',
			'co.kpi.lag': 'Average payment lag',
			'co.kpi.lag.unit': 'days',
			'co.kpi.retention': 'Retention held',
			'co.kpi.advance': 'Advance recovered',
			'sub.dated': '{n} dated',
			'sub.logged': '{n} logged',
			'sub.ofopen': '{p} of open',
			'sub.certs': '{n} certificates',
			'sub.ofcertified': '{p} of certified',
			'sub.opencerts': '{n} open certificates',
			'sub.invoices': '{n} invoices',
			'sub.collected': '{p} collected',
			'sub.share': '{p} share',
			'sub.certificates': '{n} certificates',
			'sub.rows': '{n} rows',
			'sub.packages': '{a} + {b}',
			'th.ipc': 'IPC',
			'th.date': 'Certificate date',
			'th.certified': 'Certified',
			'th.vat': 'VAT',
			'th.paid': 'Paid',
			'th.paydate': 'Paid on',
			'th.fx': 'FX',
			'th.note': 'Note',
			'th.lag': 'Lag',
			'th.amount': 'Amount',
			'th.tax': 'Tax',
			'th.total': 'Total',
			'th.received': 'Received',
			'th.recvdate': 'Received on',
			'th.ref': 'Invoice',
			'th.period': 'Period',
			'th.retthis': 'Retention this IPC',
			'th.retcum': 'Retention cumulative',
			'th.advthis': 'Advance recovered',
			'th.advcum': 'Advance cumulative',
			'th.code': 'Item',
			'th.desc': 'Description',
			'th.boq': 'BOQ value',
			'th.prev': 'Previous',
			'th.cur': 'This IPC',
			'th.cum': 'Cumulative',
			'th.share': 'Share',
			'ui.total': 'Total',
			'ui.months': '{n} months',
			'ui.top': 'top {n}',
			'src.letters': 'Source: md_Letters_* OCR markdown records — one row per letter reference.',
			'src.meetings': 'Source: the OCR minute books listed in the workbench configuration.',
			'src.docs': 'Files live under the project folder named in the workbench configuration; this workbench indexes them read-only.',
			'dc.type': 'Type',
			'shell.mark.sub': 'EPC · Package 01 / 02',
			'shell.flow': 'contractor → counterparty',
			'shell.flow.main': 'main contract',
			'shell.flow.sub': 'subcontract',
			'co.retention.title': 'Retention and advance recovery',
			'co.retention.note': 'latest {n} certificates',
			'co.boq.title': 'Bill of quantities progress',
			'co.boq.note': 'IPC {no}',
			'co.chart.paid': 'Paid to subcontractor',
			'co.note.ipcs': 'Amounts in the currency of the selected package. Source: the interim payment register, subcontract sheet.',
			'co.note.employer': 'Receipts recorded against invoices issued to the employer.',
			'co.note.retention': 'Retention limit 5% of certified value; advance recovered at 10% of each certificate.',
			'co.note.boq': 'Bill of quantities taken from the ‘SUM ACC’ sheet of {no}.',
			'co.chart.employer': 'Invoiced to employer',
			'co.lag.title': 'Payment lag',
			'co.lag.avg': 'Average',
			'co.lag.med': 'Median',
			'co.lag.max': 'Worst',
			'co.lag.n': 'Certificates measured',
			'co.empty': 'No records for this selection',
			'co.sub.main': 'Main contract {no} · every figure split into the currencies it is certified in',
			'co.tab.main.ipas': 'Certificates',
			'co.tab.main.adjust': 'Price adjustment',
			'co.tab.main.bills': 'Bills',
			'co.tab.main.summary': 'Statement',
			'co.kpi.main.contract': 'Main contract value',
			'co.kpi.main.certified': 'Certified to date',
			'co.kpi.main.works': 'Works certified',
			'co.kpi.main.latest': 'Latest certificate',
			'co.kpi.main.adjust': 'Price adjustment certified',
			'co.kpi.main.gross': 'Gross valuation',
			'co.kpi.main.advance': 'Advance recovered',
			'co.kpi.main.retention': 'Retention held',
			'co.kpi.main.due': 'Amount due this statement',
			'co.main.advancepct': '{n}% of the original contract price',
			'co.main.retentionpct': 'capped at {n}% of certified value',
			'co.main.chart': 'Certified per certificate',
			'co.main.cum': 'Cumulative certification',
			'co.main.cum.note': 'running total at each certificate',
			'co.note.main.ipas': 'Parsed {f} certificates; {p} exist only as scanned PDFs and are left as gaps. Amounts are shown in every currency the certificate is issued in.',
			'co.note.main.adjust': 'Escalation ledger — the employer-approved monthly adjustment, the contractor request and the non-adjustable preliminaries for every certificate.',
			'co.note.main.bills': 'Bill-level summary of certificate {ipa}, read from its “M-S” sheet.',
			'co.note.main.summary': 'Closing statement of the latest certificate: gross valuation less advance recovery and retention gives the net present claim.',
			'co.th.employerMonth': 'Employer monthly',
			'co.th.employerCum': 'Employer cumulative',
			'co.th.contractorMonth': 'Contractor request',
			'co.th.contractorCum': 'Request cumulative',
			'co.th.line': 'Line',
			'co.th.cur': 'This certificate',
			'co.th.curusd': 'This certificate, 2nd ccy',
			'co.st.gross': 'Gross valuation of the works',
			'co.st.adjust': 'Price adjustment',
			'co.st.advance': 'Repayment of advance payment',
			'co.st.retention': 'Retention',
			'co.st.deductions': 'Total deductions',
			'co.st.total': 'Net certified',
			'co.st.present': 'Present claim',
			'co.st.due': 'Amount due this statement',
			'co.st.gross.note': 'work done plus price adjustment plus duty fee, less documents-against-acceptance charges',
			'co.st.advance.note': 'advance paid {v}, recovered from each interim certificate',
			'co.st.retention.note': 'held at {n}% of each certificate, released after taking-over',
			'co.st.total.note': 'gross valuation less deductions',
			'co.st.due.note': 'certificate dated {d}',
			'th.ipa': 'IPA',
			'th.certified.usd': 'Certified, 2nd ccy',
			'th.cum.usd': 'Cumulative, 2nd ccy',
			'th.contract': 'Contract',
			'sub.ofvalue': '{p} of contract value',
			'sub.ofgross': '{p} of gross valuation',
			'mc.section': 'Main contract',
			'mc.kpi.contract': 'Main contract value',
			'mc.kpi.contractrev': 'Revised contract price',
			'mc.kpi.orig': 'original {v}',
			'mc.kpi.certified': 'Works certified',
			'mc.kpi.latest': 'Latest main certificate',
			'mc.kpi.adjust': 'Price adjustment certified',
			'lc.title': 'Correspondence',
			'lc.sub': '{total} letters logged, {dated} dated',
			'lc.series.all': 'All directions',
			'lc.th.no': 'Reference',
			'lc.th.subject': 'Subject',
			'lc.th.date': 'Date',
			'lc.th.series': 'Direction',
			'lc.th.code': 'Code',
			'lc.search': 'Search subject or reference…',
			'lc.bycode': 'Letters by document code',
			'lc.bymonth': 'Volume by month',
			'lc.topsubj': 'Most frequent subjects',
			'lc.showing': 'showing {n} of {total}',
			'lc.more': 'Load 100 more',
			'mt.title': 'Meetings',
			'mt.sub': '{total} minutes across both series',
			'mt.th.ref': 'Reference',
			'mt.th.date': 'Date',
			'mt.th.series': 'Series',
			'mt.bymonth': 'Meetings by month',
			'mt.timeline': 'Recent minutes',
			'ql.title': 'Quality & defects',
			'ql.sub': '{total} defect records, {open} open',
			'ql.th.ref': 'Reference',
			'ql.th.disc': 'Disc.',
			'ql.th.loc': 'Location',
			'ql.th.desc': 'Description',
			'ql.th.cat': 'Grade',
			'ql.th.target': 'Target date',
			'ql.th.status': 'Status',
			'ql.th.days': 'Days',
			'ql.th.prio': 'Priority',
			'ql.overdue': 'Overdue only',
			'ql.bygrade': 'Severity mix',
			'ql.byloc': 'Top locations',
			'ql.byprio': 'Priority mix',
			'ql.disc.c': 'Civil',
			'ql.disc.e': 'Electrical',
			'ql.disc.m': 'Mechanical',
			'ql.grade': 'Grade {g}',
			'ql.ungraded': 'ungraded',
			'ql.unset': 'unset',
			'ql.sub.grade': 'severity {g} open',
			'ql.sub.locs': '{n} of {m} locations listed',
			'ql.note': '{n} of {total} defect rows available in this view · source defect\\DL.xlsx',
			'ql.status.open': 'Open',
			'ql.status.closed': 'Closed',
			'dc.title': 'Documents',
			'dc.sub': 'Contracts, taking-over certificates and project records',
			'dc.contracts': 'Contract documents',
			'dc.toc': 'Taking-over certificates',
			'dc.toc.issued': 'Issued',
			'dc.toc.draft': 'Draft',
			'dc.materials': 'Material submissions',
			'dc.media': 'Site media',
			'dc.photos': 'Photographs',
			'dc.videos': 'Videos',
			'dc.pdfletters': 'Scanned letters',
			'dc.files': 'files',
			'dc.files.n': '{n} files',
			'dc.file.one': '1 file',
			'dc.retention': 'Retention and advance',
			'dc.sub.contracts': 'contract and insurance',
			'dc.sub.toc': '{i} issued · {d} draft',
			'dc.sub.materials': 'material codes',
			'dc.sub.media': 'photos, videos, scans',
			'th.size': 'Size',
			'th.name': 'Document',
			'th.state': 'State',
			'pal.title': 'Search project records',
			'pal.placeholder': 'Search {n} records — letters, meetings, defects, certificates…',
			'pal.empty': 'No matching records',
			'pal.hint': '↑↓ navigate · ⏎ open · esc close',
			'status.records': '{n} records',
			'status.data': 'data {date}',
			'status.live': 'local dataset',
			'src.title': 'Project',
			'src.bundled': 'Demo dataset',
			'src.bundled.note': 'shipped with the plugin',
			'src.folder': 'Project folder',
			'src.read': 'read {date}',
			'src.reading': 'Reading the project folder…',
			'src.reading.hint': 'Discovery is reading the letters, minutes and certificates. A large project takes a minute or two.',
			'src.pick': 'Choose folder',
			'src.pick.hint': 'Read a project folder from this machine. The folder is opened read-only.',
			'src.reset': 'Use demo data',
			'src.reset.hint': 'Go back to the dataset that ships with the plugin.',
			'src.failed': 'Could not read that folder',
			'src.no.picker': 'This page cannot open a folder chooser here. Set the folder in the workbench configuration instead.',
			'kind.L': 'Letter',
			'kind.M': 'Meeting',
			'kind.D': 'Defect',
			'kind.I': 'IPC',
			'kind.C': 'Main IPA',
			'kind.S': 'Scan',

			/* contract register — every view carries it */
			'scope.main': 'Main contract',
			'scope.p01': 'Package 1',
			'scope.p02': 'Package 2',
			'scope.employer': 'employer',
			'scope.subcontractor': 'subcontractor',
			'scope.formerly': 'formerly {name}',
			'scope.rec': '{l} letters · {c} certificates',
			'scope.origvalue': 'original {v}',
			'scope.register': 'Contracts under administration',
			'scope.register.note': 'The main contractor is paid by the employer under the main contract and pays the subcontractors under the packages. Every view can be read against any of them.',
			'scope.on': 'Reading {no}',
			'scope.filtered': 'filtered to {no}',
			'scope.all': 'All contracts',
			'scope.standpoint': 'From the main contractor standpoint',
			'scope.parties': 'Parties',
			'scope.rename.note': 'The employer and the subcontractor were both renamed during the project; the names used at the time remain in the records.',
			'scope.main.party': 'Employer',
			'scope.sub.party': 'Subcontractor',
			'scope.contractor': 'Main contractor',

			/* signed certificate scans */
			'dc.scans': 'Signed certificates',
			'dc.sub.scans': '{a} amended',
			'dc.scans.note': '{n} scanned certificates from the employer, indexed by reference — the certificates carry no text layer, so amounts come from the workbook series',
			'dc.th.ref': 'Reference',
			'dc.th.cert': 'Certificate',
			'dc.th.issuer': 'Issuer',
			'dc.cert.no': 'No. {n}',
			'dc.kind.signed': 'Signed',
			'dc.kind.amended': 'Amended',
			'dc.kind.enclosure': 'Enclosure'
		};

		var ZH = {
			'meta.title': 'EPC 项目管理工作台',
			'meta.description': 'EPC 合同的项目控制台 — 进度、付款、往来函件、会议纪要、缺陷与文档。',
			'nav.panel': 'EPC 工作台',
			'app.loading': '正在加载项目数据…',
			'app.error': '无法加载项目数据集。',
			'app.retry': '重试',
			'cluster.project': '项目',
			'cluster.delivery': '履约',
			'cluster.records': '档案',
			'view.overview': '总览',
			'view.commercial': '商务付款',
			'view.correspondence': '往来函件',
			'view.meetings': '会议纪要',
			'view.quality': '质量与缺陷',
			'view.documents': '文档资料',
			'action.search': '全局检索',
			'action.back': '返回对话',
			'action.collapse': '收起导航',
			'action.expand': '展开导航',
			'action.all': '全部',
			'action.reset': '重置',
			'seg.p01': 'Package 1',
			'seg.p02': '第二份分包',
			'seg.main': '主合同',
			'seg.both': '全部标段',
			'ov.title': '项目总览',
			'ov.sub': '{name} · {site}',
			'ov.kpi.contract': '合同总额',
			'ov.kpi.paid': '已付分包商',
			'ov.kpi.letters': '函件总数',
			'ov.kpi.defects': '未闭合缺陷',
			'ov.kpi.certified': '累计计量',
			'ov.kpi.overdue': '逾期缺陷',
			'ov.kpi.meetings': '会议纪要',
			'ov.kpi.unpaid': '已计量未付款',
			'ov.cert.title': '最新期中付款证书',
			'ov.cert.note': 'IPC {no} · 期间 {period}',
			'ov.cert.previous': '前期累计计量',
			'ov.cert.current': '本期计量',
			'ov.cert.cumulative': '累计计量',
			'ov.cert.retention': '本期保留金',
			'ov.cert.advance': '本期预付款回收',
			'ov.cert.net': '本期应付净额',
			'ov.cert.ofvalue': '占合同总值 {p}',
			'ov.cert.ofrevised': '占调整后合同价 {p}',
			'ov.cert.workrevised': '已完成工程，占调整后合同价 {p}',
			'ov.party.employer': '业主',
			'ov.party.contractor': '总承包商',
			'ov.party.subcontractor': '分包商',
			'ov.party.epc': 'EPC 合同',
			'ov.party.p02': '第二份分包合同',
			'ov.party.p01value': '第一份分包合同额',
			'ov.party.p02value': '第二份分包合同额',
			'ov.party.mainprice': '主合同价格',
			'ov.flow.title': '函件收发量',
			'ov.flow.note': '每月函件数',
			'ov.flow.note.main': '按月向业主计量',
			'ov.flow.title2': '付款拨付',
			'ov.flow.note2': '按月支付分包商',
			'ov.flow.note3': '业主开票至收款',
			'ov.contract.title': '合同参与方',
			'ov.grade.title': '缺陷严重程度',
			'ov.grade.note': '仅未闭合项',
			'ov.disc.title': '缺陷专业分布',
			'ov.pkg.title': '函件标段分布',
			'ov.recent.title': '最新往来函件',
			'ov.recent.note': '最近 12 条',
			'ov.milestone.title': '关键档案',
			'co.title': '商务付款',
			'co.sub': '期中付款证书、保留金与资金状况',
			'co.tab.ipcs': '付款证书',
			'co.tab.employer': '业主回款',
			'co.tab.retention': '保留金与预付款',
			'co.tab.boq': '证书明细',
			'co.kpi.certified': '累计计量（分包）',
			'co.kpi.certified.all': '累计计量（全部分包）',
			'co.kpi.paid': '累计支付（分包）',
			'co.kpi.invoiced': '对业主开票',
			'co.kpi.received': '业主已回款',
			'co.kpi.unpaid': '待付款',
			'co.kpi.lag': '平均付款周期',
			'co.kpi.lag.unit': '天',
			'co.kpi.retention': '累计保留金',
			'co.kpi.advance': '累计预付款回收',
			'sub.dated': '{n} 封有日期',
			'sub.logged': '共 {n} 条',
			'sub.ofopen': '占未闭合 {p}',
			'sub.certs': '{n} 期证书',
			'sub.ofcertified': '占计量 {p}',
			'sub.opencerts': '{n} 期未付',
			'sub.invoices': '{n} 张发票',
			'sub.collected': '回款率 {p}',
			'sub.share': '占比 {p}',
			'sub.certificates': '{n} 期证书',
			'sub.rows': '{n} 行',
			'sub.packages': '{a} + {b}',
			'th.ipc': '期次',
			'th.date': '证书日期',
			'th.certified': '计量金额',
			'th.vat': '增值税',
			'th.paid': '实付金额',
			'th.paydate': '付款日期',
			'th.fx': '汇率',
			'th.note': '备注',
			'th.lag': '周期',
			'th.amount': '金额',
			'th.tax': '税额',
			'th.total': '合计',
			'th.received': '实收',
			'th.recvdate': '收款日期',
			'th.ref': '发票',
			'th.period': '期间',
			'th.retthis': '本期保留金',
			'th.retcum': '累计保留金',
			'th.advthis': '本期预付款回收',
			'th.advcum': '累计预付款回收',
			'th.code': '编号',
			'th.desc': '描述',
			'th.boq': '清单金额',
			'th.prev': '前期',
			'th.cur': '本期',
			'th.cum': '累计',
			'th.share': '占比',
			'ui.total': '合计',
			'ui.months': '{n} 个月',
			'ui.top': '前 {n} 项',
			'src.letters': '数据源：md_Letters_* OCR 记录，每个函件编号一行。',
			'src.meetings': '数据源：工作台配置中列出的 OCR 纪要目录。',
			'src.docs': '文件位于工作台配置指定的项目目录，本工作台仅做只读索引。',
			'dc.type': '类型',
			'shell.mark.sub': 'EPC · 标包 01 / 02',
			'shell.flow': '承包商 → 对方',
			'shell.flow.main': '主合同',
			'shell.flow.sub': '分包合同',
			'co.retention.title': '保留金与预付款回收',
			'co.retention.note': '最近 {n} 期证书',
			'co.boq.title': '工程量清单完成情况',
			'co.boq.note': 'IPC {no}',
			'co.chart.paid': '支付分包商',
			'co.note.ipcs': '金额单位为该分包合同币种。数据源：期中付款记录中的分包工作表。',
			'co.note.employer': '对业主开票后的实际收款记录。',
			'co.note.retention': '保留金上限为计量金额的 5%；每期按 10% 回收预付款。',
			'co.note.boq': '工程量清单取自 {no} 的「SUM ACC」工作表。',
			'co.chart.employer': '对业主开票',
			'co.lag.title': '付款周期',
			'co.lag.avg': '平均',
			'co.lag.med': '中位数',
			'co.lag.max': '最长',
			'co.lag.n': '统计期数',
			'co.empty': '当前筛选无记录',
			'co.sub.main': '主合同 {no} · 各项金额按其实际币种分列',
			'co.tab.main.ipas': '付款证书',
			'co.tab.main.adjust': '调价',
			'co.tab.main.bills': '分项账单',
			'co.tab.main.summary': '结算单',
			'co.kpi.main.contract': '主合同额',
			'co.kpi.main.certified': '累计确认',
			'co.kpi.main.works': '已计量工程',
			'co.kpi.main.latest': '最新一期证书',
			'co.kpi.main.adjust': '已确认调价',
			'co.kpi.main.gross': '计价总额',
			'co.kpi.main.advance': '已回收预付款',
			'co.kpi.main.retention': '已扣保留金',
			'co.kpi.main.due': '本期应付',
			'co.main.advancepct': '原合同价的 {n}%',
			'co.main.retentionpct': '上限为已确认金额的 {n}%',
			'co.main.chart': '各期确认金额',
			'co.main.cum': '累计确认',
			'co.main.cum.note': '每期证书的累计值',
			'co.note.main.ipas': '已解析 {f} 期证书；另有 {p} 期仅以扫描 PDF 存在，作为空缺保留。金额按证书实际币种分列显示。',
			'co.note.main.adjust': '调价台账 — 各期业主批复的调价金额、承包商申报金额以及不可调的暂列费用。',
			'co.note.main.bills': '第 {ipa} 期证书的分项账单汇总，取自其「M-S」工作表。',
			'co.note.main.summary': '最新一期证书的结算构成：计价总额扣除预付款回收与保留金后为净申报额。',
			'co.th.employerMonth': '业主月度',
			'co.th.employerCum': '业主累计',
			'co.th.contractorMonth': '承包商申报',
			'co.th.contractorCum': '申报累计',
			'co.th.line': '项目',
			'co.th.cur': '本期',
			'co.th.curusd': '本期（外币）',
			'co.st.gross': '工程计价总额',
			'co.st.adjust': '价格调整',
			'co.st.advance': '预付款回收',
			'co.st.retention': '保留金',
			'co.st.deductions': '扣款合计',
			'co.st.total': '净确认额',
			'co.st.present': '本期申报',
			'co.st.due': '本期应付',
			'co.st.gross.note': '已完成工程 + 调价 + 进口关税，减去承兑单证费用',
			'co.st.advance.note': '预付款 {v}，自每期进度款中按比例回收',
			'co.st.retention.note': '按每期证书 {n}% 扣留，移交后释放',
			'co.st.total.note': '计价总额减少扣款合计',
			'co.st.due.note': '证书日期 {d}',
			'th.ipa': 'IPA',
			'th.certified.usd': '确认（外币）',
			'th.cum.usd': '累计（外币）',
			'th.contract': '合同额',
			'sub.ofvalue': '占合同总值 {p}',
			'sub.ofgross': '占计价总额 {p}',
			'mc.section': '主合同',
			'mc.kpi.contract': '主合同额',
			'mc.kpi.contractrev': '调整后合同价',
			'mc.kpi.orig': '原价 {v}',
			'mc.kpi.certified': '已计量工程',
			'mc.kpi.latest': '最新主合同证书',
			'mc.kpi.adjust': '已确认调价',
			'lc.title': '往来函件',
			'lc.sub': '共 {total} 封，{dated} 封可识别日期',
			'lc.series.all': '全部方向',
			'lc.th.no': '文号',
			'lc.th.subject': '主题',
			'lc.th.date': '日期',
			'lc.th.series': '方向',
			'lc.th.code': '类别',
			'lc.search': '搜索主题或文号…',
			'lc.bycode': '按文别代码统计',
			'lc.bymonth': '按月收发量',
			'lc.topsubj': '高频主题',
			'lc.showing': '显示 {n} / {total}',
			'lc.more': '再加载 100 条',
			'mt.title': '会议纪要',
			'mt.sub': '两个系列共 {total} 份纪要',
			'mt.th.ref': '编号',
			'mt.th.date': '日期',
			'mt.th.series': '系列',
			'mt.bymonth': '每月会议数',
			'mt.timeline': '最近纪要',
			'ql.title': '质量与缺陷',
			'ql.sub': '缺陷记录 {total} 条，未闭合 {open} 条',
			'ql.th.ref': '编号',
			'ql.th.disc': '专业',
			'ql.th.loc': '位置',
			'ql.th.desc': '描述',
			'ql.th.cat': '等级',
			'ql.th.target': '整改期限',
			'ql.th.status': '状态',
			'ql.th.days': '天数',
			'ql.th.prio': '优先级',
			'ql.overdue': '仅看逾期',
			'ql.bygrade': '等级分布',
			'ql.byloc': '主要位置',
			'ql.byprio': '优先级分布',
			'ql.disc.c': '土建',
			'ql.disc.e': '电气',
			'ql.disc.m': '机械',
			'ql.grade': '{g} 级',
			'ql.ungraded': '未分级',
			'ql.unset': '未设置',
			'ql.sub.grade': '{g} 级未闭合',
			'ql.sub.locs': '列出 {n} / {m} 个位置',
			'ql.note': '本视图提供 {n} / {total} 条缺陷记录 · 数据源 defect\\DL.xlsx',
			'ql.status.open': '未闭合',
			'ql.status.closed': '已闭合',
			'dc.title': '文档资料',
			'dc.sub': '合同、移交证书与项目档案',
			'dc.contracts': '合同文件',
			'dc.toc': '移交证书',
			'dc.toc.issued': '已签发',
			'dc.toc.draft': '草稿',
			'dc.materials': '材料报审',
			'dc.media': '现场影像',
			'dc.photos': '照片',
			'dc.videos': '视频',
			'dc.pdfletters': '扫描函件',
			'dc.files': '个文件',
			'dc.files.n': '{n} 个文件',
			'dc.file.one': '1 个文件',
			'dc.retention': '保留金与预付款',
			'dc.sub.contracts': '合同与保险文件',
			'dc.sub.toc': '已签发 {i} · 草稿 {d}',
			'dc.sub.materials': '物料编号',
			'dc.sub.media': '照片、视频与扫描件',
			'th.size': '大小',
			'th.name': '文档',
			'th.state': '状态',
			'pal.title': '检索项目记录',
			'pal.placeholder': '在 {n} 条记录中搜索 — 函件、会议、缺陷、证书…',
			'pal.empty': '没有匹配的记录',
			'pal.hint': '↑↓ 选择 · ⏎ 打开 · esc 关闭',
			'status.records': '{n} 条记录',
			'status.data': '数据 {date}',
			'status.live': '本地数据集',
			'src.title': '项目',
			'src.bundled': '演示数据集',
			'src.bundled.note': '随插件附带',
			'src.folder': '项目文件夹',
			'src.read': '读取于 {date}',
			'src.reading': '正在读取项目文件夹…',
			'src.reading.hint': '正在识别函件、会议纪要与证书。较大的项目需要一两分钟。',
			'src.pick': '选择文件夹',
			'src.pick.hint': '读取本机上的项目文件夹，仅以只读方式访问。',
			'src.reset': '使用演示数据',
			'src.reset.hint': '回到插件自带的演示数据集。',
			'src.failed': '无法读取该文件夹',
			'src.no.picker': '当前页面无法打开文件夹选择器，请在插件配置中指定文件夹。',
			'kind.L': '函件',
			'kind.M': '会议',
			'kind.D': '缺陷',
			'kind.I': '付款',
			'kind.C': '主合同 IPA',
			'kind.S': '扫描件',

			'scope.main': '主合同',
			'scope.p01': '第一份分包',
			'scope.p02': '第二份分包',
			'scope.employer': '业主',
			'scope.subcontractor': '分包商',
			'scope.formerly': '原名 {name}',
			'scope.rec': '{l} 封函件 · {c} 期证书',
			'scope.origvalue': '原价 {v}',
			'scope.register': '监理范围内的合同',
			'scope.register.note': '主承包商在主合同下向业主收款，在各分包合同下向分包商付款。各界面均可按其中任一份合同查看。',
			'scope.on': '当前口径 {no}',
			'scope.filtered': '已筛选至 {no}',
			'scope.all': '全部合同',
			'scope.standpoint': '以总承包商视角',
			'scope.parties': '合同各方',
			'scope.rename.note': '业主与分包商在项目实施期间均已更名；当时使用的名称仍保留在原始记录中。',
			'scope.main.party': '业主',
			'scope.sub.party': '分包商',
			'scope.contractor': '总承包商',

			'dc.scans': '签字证书',
			'dc.sub.scans': '{a} 份修订',
			'dc.scans.note': '{n} 份业主签发的扫描版证书，按编号建立索引 — 扫描件无可提取文字层，金额取自工作簿序列',
			'dc.th.ref': '编号',
			'dc.th.cert': '证书',
			'dc.th.issuer': '签发方',
			'dc.cert.no': '第 {n} 期',
			'dc.kind.signed': '已签署',
			'dc.kind.amended': '修订版',
			'dc.kind.enclosure': '附件'
		};

		var DICTS = { en: EN, zh: ZH };
		var T_NOW = null;

		function t(key, vars) {
			var fn = T_NOW || function (k) { return k; };
			var text = fn(key);
			if (text === key || text == null) text = EN[key] != null ? EN[key] : key;
			if (vars) {
				text = String(text).replace(/\{(\w+)\}/g, function (m, name) {
					return vars[name] != null ? String(vars[name]) : m;
				});
			}
			return text;
		}

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

		/* -------------------------- money by currency -------------------------- */
		/* A contract price is not one number with a conversion beside it. The bill
		   rows usually sum to the price only when both slices are added, and one
		   bill can be priced entirely in the second currency while the civil works
		   are entirely in the first, so printing one slice understates the contract
		   by the other. Every money figure is therefore read as a list of currency
		   slices, and the currencies a project uses travel with the payload: a third
		   currency needs another entry in `currencies` and another set of
		   `<base><Key>` fields, not a template change. */
		function ccySuffix(code) {
			var s = String(code || '');
			return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
		}

		function ccyList(data) {
			var list = (data && data.currencies) || [];
			if (list.length > 0) {
				return list.map(function (c) {
					return {
						code: c.code,
						key: c.key || ccySuffix(c.code),
						label: c.label || c.code,
						primary: !!c.primary
					};
				});
			}
			/* A payload built before the currency table existed still prints its one
			   currency rather than nothing. */
			var primary = (data && data.project && data.project.currency) || '';
			return primary ? [{ code: primary, key: ccySuffix(primary), label: primary, primary: true }] : [];
		}

		function ccyLabelFor(data, code) {
			var list = ccyList(data);
			for (var i = 0; i < list.length; i += 1) {
				if (list[i].code === code) return list[i].label;
			}
			return code;
		}

		/* Read `<base>Lkr` / `<base>Usd` — or whatever suffixes the payload declares —
		   off one row, in the declared order. */
		function rowSlices(row, base, data) {
			if (!row) return [];
			var out = [];
			ccyList(data).forEach(function (c) {
				var v = row[base + c.key];
				if (isNum(v)) out.push({ code: c.code, label: c.label, amount: v });
			});
			return out;
		}

		/* The same shape from a list the extractor wrote out explicitly, such as
		   `contract.amounts` for the contract price. */
		function sliceList(list, data) {
			var out = [];
			(list || []).forEach(function (e) {
				if (!e || !isNum(e.amount)) return;
				out.push({ code: e.code, label: ccyLabelFor(data, e.code), amount: e.amount });
			});
			return out;
		}

		function moneyText(list, digits) {
			if (!list || list.length === 0) return '—';
			return list.map(function (e) {
				return (typeof digits === 'number' ? grouped(e.amount, digits) : compact(e.amount)) + ' ' + e.label;
			}).join(' · ');
		}

		/* A money tile: the first currency keeps the large figure and the others
		   stack beneath it inside the same tile, because they are one quantity
		   measured twice rather than two quantities. */
		function moneyKpi(labelKey, list, extra) {
			var items = list || [];
			var first = items.length > 0 ? items[0] : null;
			var rest = items.length > 1 ? items.slice(1) : [];
			var out = {
				label: t(labelKey),
				value: first ? compact(first.amount) : '—',
				unit: first && first.label ? first.label : null,
				lines: rest.map(function (e) { return { value: compact(e.amount), unit: e.label }; })
			};
			if (extra) {
				Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
			}
			return out;
		}

		function mainCapSlices(mc, data) {
			var fromPayload = sliceList((mc && mc.contract || {}).amounts, data);
			if (fromPayload.length > 0) return fromPayload;
			var v = mainCap(mc);
			var list = ccyList(data);
			return isNum(v) ? [{ code: (list[0] || {}).code || '', label: (list[0] || {}).label || '', amount: v }] : [];
		}

		function mainOrigSlices(mc, data) {
			return sliceList((mc && mc.contract || {}).amountsOrig, data);
		}

		/* The works valuation, one slice per currency, summed from the bill rows —
		   the only place the temporary and permanent works are broken out. The
		   progress percentage stays on the primary currency, because a ratio across
		   two currencies would be meaningless. */
		function mainWorksSlices(mc, data) {
			var bills = ((mc && mc.latest) || {}).bills || [];
			var out = [];
			if (bills.length === 0) return out;
			ccyList(data).forEach(function (c) {
				var sum = 0;
				var any = false;
				bills.forEach(function (b) {
					var v = b['cum' + c.key];
					if (isNum(v)) { sum += v; any = true; }
				});
				if (any && sum !== 0) out.push({ code: c.code, label: c.label, amount: sum });
			});
			return out;
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
							/* the tile prints every currency slice the contract is
							   priced in, not only the one it is administered in */
							h('span', { className: 'epc-cbtn-val mono' },
								moneyText(sliceList(c.amounts, data).length
									? sliceList(c.amounts, data)
									: [{ label: ccyLabelFor(data, c.currency), amount: c.value }]))),
						/* One meta line only: the tile already carries four pieces of
						   information and a second small line crowds the strip. */
						h('div', { className: 'epc-cbtn-rec' },
							[
								c.valueOrig != null && c.valueOrig !== c.value
									? t('scope.origvalue', { v: moneyText(sliceList(c.amountsOrig, data).length
										? sliceList(c.amountsOrig, data)
										: [{ label: ccyLabelFor(data, c.currency), amount: c.valueOrig }]) })
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
			var adjustCum = latest.adjustCumLkr != null ? latest.adjustCumLkr : (ledger.length ? ledger[ledger.length - 1].contractorCum : null);
			/* same figures the Overview band uses, so the two pages agree */
			var cap = mainCap(mc);
			var works = mainWorks(mc);
			var data = props.data;
			var capSlices = mainCapSlices(mc, data);
			var origSlices = mainOrigSlices(mc, data);
			var worksSlices = mainWorksSlices(mc, data);
			var curSlices = rowSlices(latest, 'cur', data);
			var ccyFirst = ccyList(data)[0] || {};
			var adjustSlices = rowSlices(latest, 'adjustCum', data);
			if (adjustSlices.length === 0 && isNum(adjustCum)) {
				adjustSlices = [{ label: ccyFirst.label || '', amount: adjustCum }];
			}

			/* A contract priced in two currencies is certified in both, and neither
			   slice is a conversion of the other, so each tile prints all of them
			   rather than one figure under a single unit. */
			var kpis = [
				moneyKpi('mc.kpi.contractrev', capSlices, { sub: t('mc.kpi.orig', { v: moneyText(origSlices) }) }),
				moneyKpi('co.kpi.main.works', worksSlices, { sub: t('sub.ofvalue', { p: pct(works, cap) }) }),
				moneyKpi('co.kpi.main.latest', curSlices, { sub: 'IPA ' + (latest.ipa || '—') + ' · ' + shortDate(latest.period) }),
				moneyKpi('co.kpi.main.adjust', adjustSlices, { sub: t('sub.ofgross', { p: pct(adjustCum, latest.grossCumLkr) }) })
			];

			var kpis2 = [
				moneyKpi('co.kpi.main.gross', rowSlices(latest, 'grossCum', data), { sub: 'IPA ' + (latest.ipa || '—') }),
				moneyKpi('co.kpi.main.advance', rowSlices(latest, 'advanceRepayCum', data).map(function (e) {
					return { label: e.label, amount: Math.abs(e.amount) };
				}), { sub: t('co.main.advancepct', { n: contract.advancePct }) }),
				moneyKpi('co.kpi.main.retention', rowSlices(latest, 'retentionCum', data).map(function (e) {
					return { label: e.label, amount: Math.abs(e.amount) };
				}), { sub: t('co.main.retentionpct', { n: contract.retentionPct }) }),
				moneyKpi('co.kpi.main.due', rowSlices(latest, 'dueCum', data), { sub: t('sub.certs', { n: mc.totals.count }) })
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

					tab === 'ipas' ? mainIpaTable(ipas, mc, props.data) : null,
					tab === 'adjust' ? mainAdjustTable(ledger) : null,
					tab === 'bills' ? mainBillTable(latest.bills || [], contract, data) : null,
					tab === 'statement' ? mainStatement(latest, mc, data) : null,

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

			/* A package is priced in one currency, but the label still comes from the
			   register rather than from a literal, so a project whose packages are
			   priced elsewhere prints its own currency instead of the template's. */
			var pkgCcy = (contractById(data, pkg) || {}).currency;
			var pkgSlices = function (amount) {
				return [{ label: ccyLabelFor(data, pkgCcy), amount: amount }];
			};

			var kpis = [
				moneyKpi('co.kpi.certified', pkgSlices(totals.certified), { sub: t('sub.certs', { n: certs.length }) }),
				moneyKpi('co.kpi.paid', pkgSlices(totals.paid), { sub: t('sub.ofcertified', { p: pct(totals.paid, totals.certified) }) }),
				moneyKpi('co.kpi.unpaid', pkgSlices(totals.unpaidAmount), { sub: t('sub.opencerts', { n: totals.unpaidCount }) }),
				{ label: t('co.kpi.lag'), value: String(payments.lag.avg), unit: t('co.kpi.lag.unit'), sub: t('co.lag.max') + ' ' + payments.lag.max + ' · ' + t('co.lag.n') + ' ' + payments.lag.n }
			];

			var kpis2 = [
				moneyKpi('co.kpi.invoiced', pkgSlices(totals.employerInvoiced), { sub: t('sub.invoices', { n: (payments.employer || []).length }) }),
				moneyKpi('co.kpi.received', pkgSlices(totals.employerReceived), { sub: t('sub.collected', { p: pct(totals.employerReceived, totals.employerInvoiced) }) }),
				moneyKpi('co.kpi.retention', pkgSlices(ret ? ret.retCum : null), { sub: pkg + ' · ' + shortDate(ret ? ret.period : null) }),
				moneyKpi('co.kpi.advance', pkgSlices(ret ? ret.advCum : null), { sub: pkg + ' ' + (ret ? ret.ipc : '') })
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

		function mainIpaTable(rows, mc, data) {
			if (rows.length === 0) return h(Empty, null, t('co.empty'));
			var sorted = rows.slice().sort(function (a, b) {
				return (b.ipa || 0) - (a.ipa || 0);
			});
			/* The share column measures the cumulative certificate against the revised
			   price, not the original sum: the cumulative figure carries the price
			   adjustment, so against the original sum it would pass 100% and read as
			   an arithmetic error rather than as an escalation claim. */
			var ccys = ccyList(data);
			var base = ccys[0] || {};
			var contractBase = isNum(mc && mc.contract && mc.contract.revisedLkr) ? mc.contract.revisedLkr : mainCap(mc);
			/* One certified column and one cumulative column per currency, named after
			   the currency rather than numbered: "2nd currency" stops meaning anything
			   as soon as a project prices itself in three. */
			var headCert = ccys.map(function (c) {
				return h('th', { key: 'hc' + c.code, className: 'r' }, t('th.certified') + ' ' + c.label);
			});
			var headCum = ccys.map(function (c) {
				return h('th', { key: 'hu' + c.code, className: 'r' }, t('th.cum') + ' ' + c.label);
			});
			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('th.ipa')),
					h('th', null, t('th.period')),
					headCert,
					headCum,
					h('th', { style: { width: '120px' } }, t('th.share')))),
				h('tbody', null, sorted.map(function (r, i) {
					var shareNum = isNum(r['cum' + base.key]);
					var share = isNum(contractBase) && contractBase > 0 && shareNum ? r['cum' + base.key] / contractBase : 0;
					return h('tr', { key: 'm' + i },
						h('td', { className: 'mono' }, 'IPA ' + r.ipa),
						h('td', { className: 'mono dim' }, shortDate(r.period)),
						ccys.map(function (c, ci) {
							return h('td', { key: 'c' + c.code, className: 'r mono' + (ci === 0 ? '' : ' dim') }, grouped(r['cur' + c.key], 2));
						}),
						ccys.map(function (c, ci) {
							return h('td', { key: 'u' + c.code, className: 'r mono' + (ci === 0 ? '' : ' dim') }, grouped(r['cum' + c.key], 2));
						}),
						h('td', null,
							h(ProgressBar, {
								value: share,
								color: share >= 1 ? 'var(--epc-good)' : 'var(--epc-accent)',
								title: (share * 100).toFixed(1) + '%'
							})));
				})),
				h('tfoot', null, h('tr', null,
					h('td', { colSpan: 2, style: { padding: '8px 12px', fontWeight: 650 } }, t('ui.total')),
					ccys.map(function (c) {
						return h('td', { key: 'tc' + c.code }, null);
					}),
					ccys.map(function (c, ci) {
						var v = ci === 0 ? (mc.totals || {}).certifiedLkr : (mc.totals || {})['certified' + c.key];
						return h('td', { key: 'tu' + c.code, className: 'r mono', style: { padding: '8px 12px' } }, grouped(v, 2));
					}),
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

		function mainBillTable(bills, contract, data) {
			var items = (bills || []).filter(function (b) { return b && b.desc; });
			if (items.length === 0) return h(Empty, null, t('co.empty'));
			/* The main contract is a sum of currency slices, not a single amount
			   converted for display: a line priced entirely in the second currency
			   would read as zero under a single-currency column. One triple of
			   columns per currency present keeps every slice visible and adds a
			   fourth currency without touching this code. */
			var ccys = ccyList(data);
			var head = [h('th', { key: 'c', className: 'r' }, t('th.code')), h('th', { key: 'd' }, t('th.desc'))];
			ccys.forEach(function (c) {
				head.push(h('th', { key: 'k' + c.code, className: 'r' }, t('th.contract') + ' ' + c.label));
			});
			ccys.forEach(function (c) {
				head.push(h('th', { key: 't' + c.code, className: 'r' }, t('co.th.cur') + ' ' + c.label));
			});
			ccys.forEach(function (c) {
				head.push(h('th', { key: 'm' + c.code, className: 'r' }, t('th.cum') + ' ' + c.label));
			});
			head.push(h('th', { key: 's', className: 'r', style: { width: '78px' } }, t('th.share')));

			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null, head)),
				h('tbody', null, items.map(function (b, i) {
					/* The share is measured against the first currency that carries a
					   contract amount for this line, and the cumulative figure of the
					   same currency — mixing slices would produce a ratio of two
					   different currencies. */
					var basis = null, baseKey = null;
					ccys.forEach(function (c) {
						if (basis === null && isNum(b['contract' + c.key]) && b['contract' + c.key] > 0) {
							basis = b['contract' + c.key];
							baseKey = c.key;
						}
					});
					var share = basis !== null && isNum(b['cum' + baseKey]) ? b['cum' + baseKey] / basis : null;
					var cells = [
						h('td', { key: 'c', className: 'mono' }, b.code || '—'),
						h('td', { key: 'd' }, h('div', { className: 'epc-clip', style: { maxWidth: '290px' } }, String(b.desc).trim()))
					];
					ccys.forEach(function (c, ci) {
						cells.push(h('td', { key: 'k' + c.code, className: 'r mono' + (ci === 0 ? '' : ' dim') }, grouped(b['contract' + c.key], 2)));
					});
					ccys.forEach(function (c, ci) {
						cells.push(h('td', { key: 't' + c.code, className: 'r mono' + (ci === 0 ? '' : ' dim') }, grouped(b['cur' + c.key], 2)));
					});
					ccys.forEach(function (c, ci) {
						cells.push(h('td', { key: 'm' + c.code, className: 'r mono' + (ci === 0 ? '' : ' dim') }, grouped(b['cum' + c.key], 2)));
					});
					cells.push(h('td', { key: 's', className: 'r mono dim' }, share === null ? '—' : (share * 100).toFixed(1) + '%'));
					return h('tr', { key: 'bl' + i }, cells);
				})),
				h('tfoot', null, h('tr', null, (function () {
					var foot = [h('td', { key: 'c', colSpan: 2, style: { padding: '8px 12px', fontWeight: 650 } }, t('ui.total'))];
					['contract', 'cur', 'cum'].forEach(function (part) {
						ccys.forEach(function (c) {
							foot.push(h('td', { key: part + c.code, className: 'r mono', style: { padding: '8px 12px' } },
								grouped(sumBy(items, part + c.key), 2)));
						});
					});
					foot.push(h('td', { key: 's' }));
					return foot;
				})())));
		}

		function mainStatement(latest, mc, data) {
			var ledger = mainLedger(mc);
			var adjust = latest.adjustCumLkr != null ? latest.adjustCumLkr
				: (ledger.length ? ledger[ledger.length - 1].contractorCum : null);
			/* Each row names the field base rather than a value, because every line
			   is certified per currency and the cell has to print all of them. */
			var rows = [
				['co.st.gross', 'grossCum', t('co.st.gross.note')],
				['co.st.adjust', 'adjustCum', null],
				['co.st.advance', 'advanceRepayCum', latest.advanceCumLkr != null ? t('co.st.advance.note', { v: moneyText(rowSlices(latest, 'advanceCum', data)) }) : null],
				['co.st.retention', 'retentionCum', t('co.st.retention.note', { n: (mc.contract || {}).retentionPct })],
				['co.st.deductions', 'deductionsCum', null],
				['co.st.total', 'totalCum', t('co.st.total.note')],
				['co.st.present', 'presentCum', null],
				['co.st.due', 'cur', t('co.st.due.note', { d: shortDate(latest.period) })]
			];

			return h('table', { className: 'epc-tbl' },
				h('thead', null, h('tr', null,
					h('th', null, t('co.th.line')),
					h('th', { className: 'r' }, t('th.cum')),
					h('th', null, t('th.note')))),
				h('tbody', null, rows.map(function (r, i) {
					var emph = r[0] === 'co.st.total' || r[0] === 'co.st.due';
					var slices = rowSlices(latest, r[1], data);
					/* 'advanceRepayCum' is absent on payloads that only carry the
					   advance paid, so the deduction is rebuilt from that figure —
					   the row reads as a deduction, never as an addition. */
					if (r[1] === 'advanceRepayCum' && slices.length === 0) {
						slices = rowSlices(latest, 'advanceCum', data).map(function (e) {
							return { label: e.label, amount: -e.amount };
						});
					}
					if (r[1] === 'adjustCum' && slices.length === 0 && isNum(adjust)) {
						slices = [{ label: (ccyList(data)[0] || {}).label || '', amount: adjust }];
					}
					var neg = slices.length > 0 && isNum(slices[0].amount) && slices[0].amount < 0;
					return h('tr', { key: 's' + i },
						h('td', { style: emph ? { fontWeight: 650 } : null }, t(r[0])),
						h('td', {
							className: 'r mono',
							style: {
								fontWeight: emph ? 650 : null,
								color: neg ? 'var(--epc-dim)' : null
							}
						}, moneyText(slices, 2)),
						h('td', { className: 'dim' }, h('div', { className: 'epc-clip', style: { maxWidth: '320px' } }, r[2] || '—')));
				})));
		}

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

		/* ============================ module ============================ */
		return { inject: ['slots'], apply: apply };
	}
});
