(function(){

	// APP SETUP
	// -------- 

	// required vars
		var _app,

		product_json,
		manufacturer_json,

		product_db,
		manufacturer_db,
		product_id_keystore,
		manufacturer_id_keystore,
		products_grouped_by_manufacturer,

		deviceStorage,

		viewport,
		collapsible_sections,
		active_collapsible,

		about_page_section,
		about_page_section_subheader,

		product_search_input,
    	search_buffer, 
    	search_buffer_duration;

	// REQ MODULE: INIT

		// id: app-init

		//	REQ CHANNELS
		//	* dom-is-ready
		//	* app-setup-complete

		init();

		function init(){	

			var module_id = 'app-init';		

		    // set initial search buffer duration
		    	search_buffer_duration = 200;

		    // glue modules and events together
				setupModuleGlue();

			// "sunrise" modules
				setupGoogleAnalytics();	    		
				setupAppcache();

			// 	dom-is-ready => setup-app
				_app.subscribe_once('dom-is-ready', module_id, setup_app);
				
			// app-setup-complete => render-cached-product-list
				_app.subscribe_once('app-setup-complete', module_id, render_cached_product_list);
			
			// watch for dom-is-ready
				setupDOMReady();
		}

    // MODULE: MODULE GLUE
    	function setupModuleGlue(){
    		
	    	var Observer;

	    	Observer = require('./js/cjs-pubsub.js');
	    	_app = new Observer({ consoleLog: true });
    	}

    // MODULE: DOM READY

    	// id: dom-ready

		// OUTPUT CHANNELS
		//	* dom-is-ready

    	function setupDOMReady(){

    		// req vars
	    		var module_id = 'dom-ready';

    		// on dom ready, tell the modules
	    		window.addEventListener('DOMContentLoaded', function(){

	    			_app.publish('dom-is-ready', module_id);
	    		});
    	}

	// MODULE: GOOGLE ANALYTICS

		// id: google-analytics 

	    //  REQ CHANNELS
	    //	* device-has-appcache	
	    //	* offline-databases-updated	
	    //	* server-not-reached	
	    //	* slow-search-render
	    //	* section-view-switched

	    function setupGoogleAnalytics(){

	    	// set module id
	    		var module_id = 'google-analytics';

	    	// can work offline
		    	_app.subscribe_once('device-has-appcache', module_id, function(){

		            ga('send','event','device-has-appcache');
		    	});

		    // offline databases updated
		    	_app.subscribe_once('offline-databases-updated', module_id, function(){

					ga('send','event','offline-databases-updated');
		    	});

		    // server not reached
		    	_app.subscribe('server-not-reached', module_id, function(){
		    		
					ga('send','event','server-not-reached');
		    	})

		    // slow search render (longer than 16ms == less than 60fps)
		    	_app.subscribe('slow-search-render', module_id, function(){

		    		ga('send','event','slow-search-render');
		    	});

		    // section view switched
		    	_app.subscribe('section-view-switched', module_id, function(data){

			        ga('send','event', data.notificationParams + "-active");
		    	});
	    }

	// MODULE: APPCACHE

		// OUTPUT CHANNELS
		//	* device-has-appcache
	    
	    function setupAppcache(){

	        if (window.applicationCache){

	        	_app.publish('device-has-appcache');

	            window.applicationCache.addEventListener('updateready', cacheReady);
	        }
	        
	        // new cache ready
	            function cacheReady(){     

	                alert('Update Installed! Restarting App Now');
	                window.applicationCache.swapCache();
	                location.reload(true);
	            }
	    }

	// MODULE: LOCAL DATABASE
	    function setupDeviceStorage(){

	        deviceStorage = new Persist.Store('Pricing App Storage', {

	            about: "Data Storage to enhance Offline usage",
	            path: location.href
	        });
	    }

	// MODULE: DOM QUERY CACHE

		function setupDOMQueryCache(){

			viewport = document.getElementById('viewport');
			collapsible_sections = viewport.getElementsByClassName('collapsible');

			about_us_section = document.getElementById('about-us');
			about_page_section = document.getElementById('about-page');
			about_page_section_subheader = about_page_section.getElementsByClassName('subtitle')[0];

			search_products_section = document.getElementById('search-products');
			product_search_input = document.getElementById('product-search-input');
			search_products_section_subheader = search_products_section.getElementsByClassName('subtitle')[0];
			product_search_results_section = search_products_section.getElementsByClassName('content')[0];

			product_list = document.getElementById('product-list');		
		}

	// MODULE: REMOVE TOUCH DELAY

		function setupRemoveTouchDelay(){			

		    require('fastclick')(document.body);
		}

	// MODULE: SEARCH

		// id: search-products

		// OUTPUT CHANNELS
		// * product-database-searched
		// * product-search-reset

		function setupSearchProducts(){

		    // activate search
		    	product_search_input.addEventListener('input', function(){

		    		var value_to_search,
		    			previous_value,
		    			previous_matches;

		    		return function(e){

		    			var current_value = e.target.value,
		    				search_start_time,
		    				search_duration,
		    				product_name_search_results,
		    				manufacturer_name_search_results,
		    				matched_manufacturer_id_array = [];

		    			if(typeof search_buffer != 'undefined'){ 
		    				clearTimeout(search_buffer); 
		    				search_buffer_duration = 305; 
		    			}

		    			search_buffer = setTimeout(do_search, search_buffer_duration);

		    			value_to_search = current_value.toLowerCase();

		    			function do_search(){

		    				// required vars
		    					var markup_to_render = "",
		    						array_sort;

		    				// don't search if ...
				    			if( typeof product_json == 'undefined' || // no product data
				    				typeof manufacturer_json == 'undefined' || // no manufacturer data
				    				current_value === previous_value // search value matches last search
				    			){ 

				    				console.log("didn't bother searching .. ");
				    				return;
				    			}

				    		// wipe results if search field is blank
				    			if(value_to_search === ""){

				    				previous_value = "";
				    				previous_matches = "";

				    				product_search_results_section.innerHTML = "";
				    				search_products_section_subheader.innerHTML = "";

									removeClass(product_search_results_section, "unique-match");
									removeClass(product_search_results_section, "swap-row-color");

									_app.publish('product-search-reset');

				    				return;
				    			}

			    			search_start_time = Date.now();

			    			// search manufacturers
			    				manufacturer_db = ( is_array(manufacturer_db) ? manufacturer_db : JSON.parse(manufacturer_json));
				    			manufacturer_name_search_results = array_search(
				    				
				    				manufacturer_db,
				    				function(manufacturer){

				    					// not a match if search value can't be found in manufacturer's name
				    					if(!manufacturer.Name || manufacturer.Name.toLowerCase().indexOf( value_to_search ) < 0 ){

				    						return false;
				    					}

				    					return true;
				    				}, 
				    				function(matched_manufacturer){

				    					matched_manufacturer_id_array.push( matched_manufacturer.Id );
				    				}
				    			);

			    			// search products
			    				var manufacturer_id_model = key_model_db_json(manufacturer_db, "Id");
			    				product_db = ( is_array(product_db) ? product_db : JSON.parse(product_json));
				    			product_name_search_results = array_search(
				    				
				    				product_db,
				    				function(product){

				    					var wholesale_price,
				    						manufacturer_id,
				    						normalized_name;

				    					wholesale_price = product.WholesalePrice;
				    					manufacturer_id = product.ManufacturerId;
				    					normalized_name = product.Name.toLowerCase();

				    					// not a match if ...
					    					if( (wholesale_price === "" || wholesale_price === null) || // no wholesale price or ... 
					    						( 
					    							normalized_name.indexOf( value_to_search ) < 0 && // search value not in name and ... 
					    							matched_manufacturer_id_array.indexOf( manufacturer_id ) < 0 // manufacturer id isn't in array of matches
					    						)  
					    					){

					    						return false;
					    					}

				    					return true;
				    				},
				    				function(matched_product){

			    					   matched_product.markup = "<li>" +
					    										  "<span class='name'>" + manufacturer_id_model[matched_product.ManufacturerId].Name + " " +  matched_product.Name + "</span>" + 
					    										  "<span class='price'>&#8358;" + matched_product.WholesalePrice + "</span>" +
					    										"</li>";
			    					}
				    			);

			    			// sort results
			    				var manufacturer_id_model = key_model_db_json(manufacturer_db, 'Id');
			    				
			    				array_sort = require('stable');

			    				product_name_search_results = array_sort(product_name_search_results, function(a,b){

			    					var name_of_a,
			    						name_of_b,
			    						manufacturer_of_a,
										manufacturer_of_b;

										manufacturer_of_a = manufacturer_id_model[ a.ManufacturerId ].Name.toLowerCase(); 
										manufacturer_of_b = manufacturer_id_model[ b.ManufacturerId ].Name.toLowerCase(); 

										if (manufacturer_of_a === manufacturer_of_b){ 

											name_of_a = a.Name.toLowerCase();
											name_of_b = b.Name.toLowerCase();

											if(name_of_a > name_of_b){

												return 1;
											}

											else if (name_of_a < name_of_b){

												return -1;
											}

											else {

												return 0;
											}
										} 

										else if (manufacturer_of_a < manufacturer_of_b){

											return -1;
										}

										else {

											return 1;
										}
			    				});

			    			// add each match to markup
			    				array_each(product_name_search_results, function(this_product){

			    					markup_to_render += this_product.markup;
			    				});

			    			// render results
			    				setTimeout(function(){

			    					var cached_previous_matches = previous_matches,
			    						cached_current_matches = product_name_search_results;

			    					return function(){

										// results changed 
											if( is_array(cached_previous_matches) && !array_is_equal(cached_current_matches, cached_previous_matches) ){

												toggleClass(product_search_results_section, "swap-row-color");
											}

										// unique result
											if(cached_current_matches.length === 1){

												addClass(product_search_results_section, "unique-match");
											}

											else {

												removeClass(product_search_results_section, "unique-match");
											}

										// render
						    				product_search_results_section.innerHTML = markup_to_render;
						    				search_products_section_subheader.innerHTML =  product_name_search_results.length + " match" + (product_name_search_results.length > 1 ? "es" : "") + "<span class='expanded'> for \"" + value_to_search + "\"</span>";						
											    						
										// logging
											var search_total_duration = Date.now() - search_start_time;								
				    						
				    						_app.publish('product-database-searched', {

				    							matches: cached_current_matches,
				    							term: value_to_search,
				    							total_matches: cached_current_matches.length
				    						});

				    						if(search_total_duration > 16){ _app.publish('slow-search-render'); }
			    					}
			    				}(), 0);

			    			// reset search internals
				    			previous_value = value_to_search;
				    			previous_matches = product_name_search_results;
				    			delete search_buffer;
				    			search_buffer_duration = 200;
		    			}
		    		}
		    	}());
		}

	// MODULE: MAIN MENU

		// id: main-menu

		// OUTPUT CHANNELS
		// * section-view-switched

		function setupMainMenu(){

			viewport.addEventListener("click", function(e){

				// required vars
					var click_target = e.target,
						array_of_focal_elements;

				// filter clicks that arent from the collapsible menu
				// filter clicks from active menu
	                while( !hasClass(click_target, "collapsible") && click_target != viewport ){

	                    if( click_target.parentNode == document.body ){ return; }
	                    click_target = click_target.parentNode;
	                }

	            	if(click_target === viewport || click_target === active_collapsible){ return; }

	            // deactivate active menu
	            	if(typeof active_collapsible != "undefined" || active_collapsible != null){

	            		removeClass(active_collapsible, "active");
	            	}

	            // activate clicked menu
	            	addClass(click_target, "active");
	            	active_collapsible = click_target;

	            // set focus on focal element
	            	array_of_focal_elements = click_target.getElementsByClassName('focal-element');
	            	if(array_of_focal_elements.length > 0){

	            		array_of_focal_elements[0].focus();
	            	}

	            _app.publish('section-view-switched', click_target.id);
			});
		}

	// MODULE: HIGHLIGHT SEARCH

		// id: highlight-search

		// REQ CHANNELS
		// * product-database-searched
		// * product-search-reset

		function setupHighlightSearch(data){

			var module_id = "highlight-search",
				array_sort = require('stable'),
				previous_highlights = [];


			_app.subscribe('product-database-searched', module_id, function(data){

				var search_results, results_crawler, manufacturer_nodes, highlighted_nodes;

				// req vars
					manufacturer_nodes = product_list.getElementsByClassName('manufacturer');

					search_results = data.notificationParams.matches;

					results_crawler = require('prop-search');

					highlighted_nodes = [];

				// remove old matches
					remove_previous_highlights();

				// style result and push it into a collection 
					array_each(search_results, function(match, index){

						var manufacturer_dom_node, product_dom_node;

						// sort products alphabetically
							products_grouped_by_manufacturer[match.ManufacturerId] = array_sort(products_grouped_by_manufacturer[match.ManufacturerId], arrayAlphaSort);

						// get manufacturer dom node
							manufacturer_dom_node = manufacturer_nodes[ results_crawler.search( manufacturer_db, function(manufacturer){ return manufacturer.Id === match.ManufacturerId }, match.ManufacturerId)[0].key ];
						
						// get product dom node
							var product_index_search = results_crawler.search( products_grouped_by_manufacturer[match.ManufacturerId], function(product){ return product.Id === match.Id }, match.Id);
							product_index = product_index_search[0].key;

							product_dom_node = manufacturer_dom_node.getElementsByClassName('product')[ product_index ];

						// highlight
							addClass(product_dom_node, 'search-result');
						
						// mark as highlighted
							highlighted_nodes.push(product_dom_node);
					});
	
					previous_highlights = highlighted_nodes;
			});

			_app.subscribe('product-search-reset', module_id, remove_previous_highlights);

			function remove_previous_highlights(){

				array_each(previous_highlights, function(highlighted){

					removeClass( highlighted, 'search-result');
				});
			}
		}

	// MODULE: CLICKABLE PRODUCTS

		// id: clickable-products

		// OUTPUT CHANNELS
		// * product-is-selected
		// * product-is-deselected
		// * all-products-unselected

		function setupClickableProducts(){

			var module_id, previous_click, manufacturer_nodes;

			module_id = "clickable-products";

			product_list.addEventListener('click', function(e){

				// required vars
					var click_target = e.target;

				// cleanup previous 
					if( hasClass(product_list,'active-product') ){

						removeClass(previous_click, 'active');
						removeClass(product_list, 'active-product');

	           			 _app.publish('product-is-deselected', { 'dom': previous_click, 'database_id': previous_click.getAttribute('data-attribute-dbid') });
					}

				// filter clicks that arent from a product
	                while( !hasClass(click_target, "product") && click_target != product_list ){

	                    click_target = click_target.parentNode;
	                }

	            	if(click_target === product_list){ 

	            		_app.publish('all-products-unselected');
	            		return; 
	            	}

	            // deactivate active product
	            	if(click_target === previous_click){ 

	            		_app.publish('all-products-unselected');

	            		previous_click = null; 
	            		return; 
	            	}

	            // activate clicked product
	            	addClass(product_list, "active-product");
	            	addClass(click_target, "active");

	            	previous_click = click_target;

	            _app.publish('product-is-selected', { 'dom': click_target, 'database_id': click_target.getAttribute('data-attribute-dbid') });
			});
		}

	// MODULE: PRODUCT OPTIONS

		// id: product-options

		// REQ CHANNELS
		// * product-list-rendered

		// OUTPUT CHANNELS
		// * product-options-activated

		function setupProductOptions(){

			var module_id = "product-options";

			_app.subscribe('product-list-rendered', module_id, function(){

				var manufacturer_nodes = product_list.getElementsByClassName('manufacturer');

				array_each(manufacturer_nodes, function(manufacturer){

					manufacturer.addEventListener('click', function(e){

						var click_target = e.target;

						// filter clicks that arent from a buy button
			                while( !hasClass(click_target, "buy-product") && click_target != manufacturer ){

			                    if( click_target.parentNode == document.body ){ return; }
			                    click_target = click_target.parentNode;
			                }

			            	if(click_target === manufacturer){ return; }

			            // do buy button stuff
				            buy_button_behavior();
							e.stopPropagation();
					});
				});

				_app.publish('product-options-activated');
			});

			function buy_button_behavior(){

				alert('Online Ordering will be Activated on September 1, 2014');
			}
		}

	// MODULE: PRODUCT IMAGE

		// id: product-image

		// REQ CHANNELS
		// * product-is-selected

		// OUTPUT CHANNELS
		// * product-image-loaded

		function setupProductImage(){

			var module_id = "product-image";

			_app.subscribe('product-is-selected', module_id, function(data){ 

				var notification, product_dom_node, img_src;

				notification = data.notificationParams;
				product_dom_node = notification.dom;

				if(product_dom_node.getAttribute('data-attribute-imgloaded') == "true"){ return; }

				img_src = product_dom_node.getAttribute('data-attribute-imgsrc');

				var img_shell = document.createElement("img");

				img_shell.addEventListener('load', function(){

					var html_gen = document.createElement('div');

					html_gen.innerHTML = "<div class='image collapsed'><img src='" + img_src + "'></div>";

					var product_price_node = product_dom_node.getElementsByClassName('wholesale-price')[0];
					product_dom_node.insertBefore(html_gen.getElementsByClassName('image')[0], product_price_node);

					product_dom_node.setAttribute('data-attribute-imgloaded', "true");

					_app.publish('product-image-loaded');
				});

				img_shell.setAttribute('src', img_src);
			});
		}

	function render_cached_product_list(){

		var cached_product_json,
			cached_manufacturer_json,

			cached_product_db,
			cached_manufacturer_db,

			cache_prime_checks_remaining = 2;

		deviceStorage.get('product', function(ok, cache){

			if(is_json(cache)){
			
				cached_product_json = cache;
				cached_product_db = JSON.parse(cache);
			}

			cache_prime_checks_remaining -= 1;
			is_cache_loaded();
		});

		deviceStorage.get('manufacturer', function(ok, cache){

			if(is_json(cache)){

				cached_manufacturer_json = cache;
				cached_manufacturer_db = JSON.parse(cache);
			}

			cache_prime_checks_remaining -= 1;
			is_cache_loaded();
		});

		function is_cache_loaded(){

			if( 
				( !is_array(cached_product_db) || !is_array(cached_manufacturer_db) ) &&
				cache_prime_checks_remaining > 0
			){
				return;
			}

			deviceStorage.get('cache-timestamp', function(ok, timestamp){

				if(typeof timestamp != "undefined" && isNaN( parseInt(timestamp)) === false && is_array(cached_product_db) && is_array(cached_manufacturer_db) ){ 

					var cache_age,
						cache_save_time,

						cache_timestamp = parseInt(timestamp),
						cache_moment = require('moment')(cache_timestamp);

					cache_age = cache_moment.fromNow();
					cache_save_time = cache_moment.calendar();

					product_json = cached_product_json;
					product_db = cached_product_db;

					manufacturer_json = cached_manufacturer_json;
					manufacturer_db = cached_manufacturer_db;

					setTimeout(function(){

						open_about_us_menu();

						setTimeout(function(){
							
							about_page_section_subheader.innerHTML = (cache_age ? "<span class='attention'><span class='collapsed'>" + cache_save_time + "</span><span class='expanded'>" + cache_age + "</span></span>" : "Prices From last download" );
							render_product_list();
						}, 175);
					}, 175);
				}

				else {
					
					setTimeout(function(){

						open_about_us_menu();

						setTimeout(function(){

							about_page_section_subheader.innerHTML = "<span class='progress'>Downloading price</span>";				
						}, 175);
					}, 175);
				}
			});
			
			cache_loading_complete();
		}

		function cache_loading_complete(){
			
			download_and_render_product_list();
		}

		function open_about_us_menu(){

			// open about-us section
		    	addClass(about_us_section, "active");
		    	active_collapsible = about_us_section; 
		}
	}

	// DOWNLOAD AND RENDER PRODUCT LIST

		// OUTPUT CHANNELS
		//	* server-not-reached	
		//	* offline-databases-updated	

		function download_and_render_product_list(){

			// required vars
			var requested_product_json,
				requested_manufacturer_json,
				download_timestamp,

				pending_requests = 2;

			// get product json from server
				HTTP_POST(
					'http://pricingapp.designbymobi.us/get-product.php',
					null,
					function(response){

						ajax_success(response, function(response){

							requested_product_json = response;
						});
					},

					ajax_fail
				);

			// get manufacturer json from server
				HTTP_POST(
					'http://pricingapp.designbymobi.us/get-manufacturer.php',
					null,
					function(response){

						ajax_success(response, function(response){

							requested_manufacturer_json = response;
						});
					},
					ajax_fail
				);

			function render_new_data(){

				// required vars
					download_timestamp = Date.now();

					products_grouped_by_manufacturer = {};
					
					product_json = requested_product_json;
					product_db = JSON.parse(product_json);

					manufacturer_json = requested_manufacturer_json;
					manufacturer_db = JSON.parse(manufacturer_json);

				
				// filter unlistable products
				// create manufacturer collection of products
					product_db = array_search(

						product_db, 
						
						function(product){

							if(parseInt(product.WholesalePrice) > 0){ return true; }
						},

						function(current_match){

							if( !products_grouped_by_manufacturer[current_match.ManufacturerId] ){ products_grouped_by_manufacturer[current_match.WholesalePrice] = []; }
							products_grouped_by_manufacturer[current_match.WholesalePrice].push(current_match);
						}
					);

				// store to device
					deviceStorage.set('product', JSON.stringify(product_db));
					deviceStorage.set('manufacturer', requested_manufacturer_json);
					deviceStorage.set('cache-timestamp', download_timestamp);

					_app.publish('offline-databases-updated');

				// do rendering
					render_product_list();

					setTimeout(function(){

						about_page_section_subheader.innerHTML = "<span class='collapsed confirmation'>" + require('moment')(download_timestamp).calendar() + "</span><span class='expanded confirmation'>current prices</span>";
					}, 155);
			}
		
			function all_metadata_loaded(){

				var is_loaded = false;

				if (typeof requested_product_json != "undefined" &&
					typeof requested_manufacturer_json != "undefined"){

					is_loaded = true;
				}

				return is_loaded;
			}

			function ajax_fail(){

				pending_requests -= 1;

				if(pending_requests < 1){

					_app.publish('server-not-reached');
				}
			}

			function ajax_success(response, process_response){

				pending_requests -= 1;

				if( is_json(response) && typeof process_response === "function"){ process_response(response); }

				if( all_metadata_loaded() ){ render_new_data(); }
			}
		}

	
	// APP GLOBAL FUNCTIONS
	// ---------------------

	// setup app
		function setup_app(){

    		setupDeviceStorage();

			setupDOMQueryCache();

		    setupRemoveTouchDelay();

		    setupSearchProducts();
			setupHighlightSearch();

			setupMainMenu();
			setupClickableProducts();
			setupProductOptions();
			setupProductImage();

			_app.publish('app-setup-complete');
		}

	// render product list

		// OUTPUT CHANNELS
		// * product-list-rendered

		function render_product_list(){

			// required variables
			var container = document.getElementById('product-list'),
				markup = "",

				pricelist_masonry,

				current_manufacturer,
				current_manufacturer_index,
				current_manufacturer_products,
				current_manufacturer_has_listable_product,

				current_product,

				empty_manufacturers_index_array = [],
				current_empty_manufacturer,
				manufacturer_nodes,
				array_sort;

			// alpha sort manufacturers
				array_sort = require('stable');
				manufacturer_db = array_sort(manufacturer_db, arrayAlphaSort);
				
			// group products by manufacturer
				products_grouped_by_manufacturer = collection_model_db_json(product_db, 'ManufacturerId');

			// iterate over manufacturer list
				array_each( manufacturer_db, function(current_manufacturer){

					// set current manufacturer and details
						current_manufacturer_has_listable_product = false;

					// add div.manufacturer and .manufacturer header to markup
						markup += "<div class='manufacturer' data-attribute-dbid='" + current_manufacturer.Id + "'>" +
							  		"<header>" + current_manufacturer.Name + "</header>";

					// alphabetically sort current manufacturer's products
						current_manufacturer_products = products_grouped_by_manufacturer[ current_manufacturer.Id ];
						current_manufacturer_products = array_sort( current_manufacturer_products, arrayAlphaSort);			

					// iterate over current manufacturer's products
						array_each( current_manufacturer_products, function(current_product){

							// filter products with no wholesale price
								if(!current_product.WholesalePrice || typeof current_product.WholesalePrice == "undefined" || current_product.WholesalePrice == null){ return; }

							// listable product for this manufacturer found
								if(!current_manufacturer_has_listable_product){ current_manufacturer_has_listable_product = true; }

							// add product to markup
								markup += "<div class='product' data-attribute-dbid='" + current_product.Id + "' data-attribute-imgsrc='http://res.cloudinary.com/hrowcuozo/image/upload/dpr_1.0,fl_png8,t_default-width/" + current_manufacturer.Name.toLowerCase() + "-" + current_product.Name.toLowerCase().replace(/ /g, "-").replace(/%20/g, "-") + ".jpg'>" + 
											"<div class='name'><span class='collapsed manufactuer-name'>" + current_manufacturer.Name + " </span><span>" + current_product.Name + "</span></div>" +
											"<div class='wholesale-price'><span class='currency'>&#8358;</span>" + current_product.WholesalePrice + "</div>" +
										    "<div class='collapsed buy-product'>buy</div>" +
										  "</div>";
						});

					// close div.manufacturer in markup
						markup += "</div>";

					// if manufacturer is empty, note it
						if(current_manufacturer_has_listable_product != true){
							
							empty_manufacturers_index_array.push(current_manufacturer_index);
						}
				});

			// render markup
				container.innerHTML = markup;

			// delete empty manufacturers
				if(empty_manufacturers_index_array.length > 0){

					manufacturer_nodes = container.getElementsByClassName('manufacturer');

					for(var loop_index = empty_manufacturers_index_array.length - 1; loop_index > -1; loop_index -= 1){

						current_empty_manufacturer = manufacturer_nodes[empty_manufacturers_index_array[loop_index]];
						current_empty_manufacturer.parentNode.removeChild(current_empty_manufacturer);
					}
				}

				var sample_manufacturer_node = container.getElementsByClassName('manufacturer')[0];

			// activate masonry
				pricelist_masonry = new Masonry( container, {

					"columnWidth": sample_manufacturer_node,
					"containerStyle": null
				});

			// relayout masonry
				var relayout_masonry = function(){ var masonry = pricelist_masonry; return function(){ masonry.layout(); }}()

				pricelist_masonry.bindResize();

				_app.subscribe('product-is-selected', 'masonry-js', relayout_masonry);
				_app.subscribe('product-image-loaded', 'masonry-js', relayout_masonry);
				_app.subscribe('optionized-a-product', 'masonry-js', relayout_masonry);
				_app.subscribe('all-products-unselected', 'masonry-js', relayout_masonry);

			_app.publish('product-list-rendered');
		}

	// get beautified date
		function get_beautified_date(timestamp){

			var date,
				month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],

				day,
				month,
				year;

			date = timestamp ? new Date(timestamp) : new Date();

			day = date.getUTCDate();
			month = date.getUTCMonth();
			year = date.getUTCFullYear();

			return month_names[month] + " " + day + ", " + year;
		}

	// search array
		function array_search(array_to_search, search_function, on_match){

			var search_matches = [];

			on_match = typeof on_match === "function" ? on_match : null;

			array_each( array_to_search, function(current_search_item){

				if( search_function(current_search_item) ){ 
				
					search_matches.push( current_search_item );

					if(on_match){ on_match( current_search_item ); }
				}
			});

			return search_matches;
		}

	// iterate over array
		function array_each(array_to_walk, processing_function){

			var array_length = array_to_walk.length,
				array_index,
				current_item;

			for (var i = array_length; i >= 1; i -= 1) {
				
				array_index = array_length - i;
				current_item = array_to_walk[array_index];

				processing_function( current_item, array_index );
			}
		}

	// array is equal
		function array_is_equal(array_1, array_2){

			var result = false;

			if( !(array_1 instanceof Array) || !(array_2 instanceof Array) || array_1.length !== array_2.length){ return result; }

			array_each(array_1, function(item, index){ 

				if(item != array_2[index]){ return result; } 
			});

			result = true;
			return result;
		}

    // model db by collection
        function collection_model_db_json( db_json, key ){

            var db,
                modelled_db = {};

            if(is_array( db_json )){

            	db = db_json;
            }

            else {

            	db = JSON.parse( db_json );
            }

            for(var row in db){

                if( !modelled_db[ db[row][key] ] ){  modelled_db[ db[row][key] ] = []; }
                
                modelled_db[ db[row][key] ].push( db[row] );
            }

            return modelled_db;
        }

    // model json by key
        function key_model_db_json( db_json, key ){

            var db,
                modelled_db = {};

            if(is_array( db_json )){

            	db = db_json;
            }

            else {

            	db = JSON.parse( db_json );
            }

            for(var row in db){

                modelled_db[ db[row][key] ] = db[row];
            }

            return modelled_db;
        }

    // XMLHTTP POST
        function HTTP_POST(url, msg, success, fail){

            // filter
                if (!url){ return false; }

            // reqs
            var server_trip = new XMLHttpRequest();
                
                msg = msg || "";
                success = success || function(response){ console.log("POST TO " + url + " SUCCESSFUL! \nRESPONSE: "); console.log(response); };
                fail = fail || function(response){ console.log("POST TO " + url + " UNSUCCESSFUL. \nXMLHTTP OBJECT:"); console.log(response); };

            // prep POST
                server_trip.open('POST', url, true);
                server_trip.setRequestHeader("Content-type","application/x-www-form-urlencoded");
                server_trip.onreadystatechange = function(){

                    // filter uncompleted responses
                        if (server_trip.readyState !=4){ return; }

                    // success
                        if ( server_trip.status > 199 && server_trip.status < 400 ){ success(server_trip.responseText); }

                    // fail
                        else{ fail(server_trip); }                      
                };

            // POST
                server_trip.send(msg);

            return true;    
        }	

    // alphabetical sort
	    function arrayAlphaSort(a, b){

	        var a_comparing_prop = a.Name.toLowerCase();
	        var b_comparing_prop = b.Name.toLowerCase();

	        if(a_comparing_prop > b_comparing_prop){ return 1; }
	        else if(b_comparing_prop > a_comparing_prop){ return -1; }
	        else { return 0; }
	    }

	// toggle class
		function toggleClass(element, nameOfClass){

			if(hasClass(element,nameOfClass)){ removeClass(element, nameOfClass); }

			else{ addClass(element, nameOfClass); } 
		}

    // check if class exists
        function hasClass(element, nameOfClass){

            return element.className.match(new RegExp('(\\s|^)'+nameOfClass+'(\\s|$)'));
        }

    // add class if it doesn't exist
        function addClass(element, nameOfClass){
        
            if ( !hasClass(element, nameOfClass) ){
                
                element.className += " "+nameOfClass;
            }
        }

    // remove class if it exists
        function removeClass(element, nameOfClass){
        
            if ( hasClass(element, nameOfClass) ){
                
                var reg = new RegExp('(\\s|^)'+nameOfClass+'(\\s|$)');
                element.className=element.className.replace(reg,' ');
            }
        }

    // is json
    	function is_json(input){

    		var input_type;

    		input_type = typeof input;

    		if(input_type != "string"){

    			return false;
    		}

    		try{

    			JSON.parse(input);
    		}

    		catch (e){

    			return false;
    		}

    		return true;
    	}

    // is array
    	function is_array(input){

    		return Object.prototype.toString.call(input) === "[object Array]";
    	} 
}());