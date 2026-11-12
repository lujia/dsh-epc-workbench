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
		var DATA_URL = '/plugins/epc-workbench/data';
		var INDEX_URL = '/plugins/epc-workbench/index';
