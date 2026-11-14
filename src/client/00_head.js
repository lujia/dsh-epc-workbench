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
