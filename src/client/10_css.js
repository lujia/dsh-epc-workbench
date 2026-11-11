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
