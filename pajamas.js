(function(Worker, Blob, URL, W) {

	var MAX_WORKERS = 10,
		SUPPORTED = Worker && Blob && URL && true,
		now = Date.now;

	// extract source from a function and store it as a guid ref
	function create_blob_ref(f) {
		return URL.createObjectURL(new Blob([get_code(f)], {type: "text/javascript"}));
	}
	function get_code(f) {
		(f+"").replace(/^.*?\{|\}.*?$/g,"");
	}

	// PoolHandler is a guid reference to a function encoded in a Blob
	var PoolHandler = create_blob_ref(function() {
		console.log("omg we're here");
		onmessage = function(ev) {
			try {
				console.debug("omg we're here");

				postMessage({
					data: new Function(ev.data.method)(ev.data.data),
					time: now()-ev.timeStamp
				});
			} catch (ex) {
				console.error("omg we're here");
				postMessage({ error: ex });
			}
		};

	});

	W.WorkerPool = function(size) {

		var pool = this,
			i = size = SUPPORTED ? Math.min(Math.abs(size), MAX_WORKERS) : 0;
		pool.callbacks = [];
		pool.nodes = [];

		while (i) {
			var w = new Worker(PoolHandler);
			w.onerror = on_error;
			w.onmessage = on_message;
			pool.nodes[--i] = w;
		}

		function on_error() { console.error(arguments); }
		function on_message(data) {
			try { pool.callbacks[data.id](data); }
			catch (ex) { on_error(ex, data); }
		}

		pool.next = function() {
			if (i == pool.nodes.length) {
				i = 0;
			}
			return pool.nodes[i++];
		};
		pool.terminate = function() {
			// reduce the array as we terminate
			while (pool.nodes.length) {
				try { pool.nodes.shift().terminate(); }
				catch (ev) { on_error(ev); }
			}
		};
		pool.run = function(method, data, callback, shared) {
			if (pool.nodes) {
				// shared determines if the data object is shared memory or copied on run
				var id = pool.callbacks.length;
				pool.callbacks[id] = callback;
				// pool.next().postMessage({m:1});
				pool.next().postMessage({
					id: id,
					method: create_blob_ref(method),
					data: data
				}, shared ? [data] : []);
			} else {
				console.log('wat?');
				var start = now();
				callback({
					data: method(data),
					time: now()-start
				});
			}
		};
	};

})(window.Worker, window.Blob, window.URL, window);