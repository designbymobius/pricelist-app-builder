(function(){

	// APP SETUP
	// -------- 

		// required vars
			var _app,

			render_count = 0,

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
	    	search_buffer_duration,

	    	render_react_product_list,
	    	pricelist_masonry;

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

			    // app event system
					setupModuleGlue();

				// vip modules
					setupGoogleAnalytics();	    		
					setupAppcache();

				// 	dom-is-ready => setup-app
					_app.subscribe_once('dom-is-ready', module_id, setup_app);
					
				// app-setup-complete => render-cached-product-list
					_app.subscribe_once('app-setup-complete', module_id, render_cached_product_list);
				
				// watch for dom-is-ready
					setupDOMReadyListener();
			}

	    // MODULE: MODULE GLUE
	    	function setupModuleGlue(){
	    		
		    	var Observer;

		    	Observer = require('./cjs-pubsub.js');
		    	_app = new Observer({ consoleLog: true });
	    	}

	    // MODULE: DOM READY LISTENER

	    	// id: dom-ready-listener

			// OUTPUT CHANNELS
			//	* dom-is-ready

	    	function setupDOMReadyListener(){

	    		// req vars
		    		var module_id = 'dom-ready-listener';

	    		// on dom ready, inform app
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

						var alert = require('alertify').alert;    

		                alert('Update Installed! Restarting App Now', function(){

			                window.applicationCache.swapCache();
			                location.reload(true);

		                }, 'alertify-warning');	            
		            }
		    }

		// MODULE: LOCAL DATABASE
		    function setupDeviceStorage(){

		    	var Persist = require('persist');

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

			// REQ CHANNELS
			// * downloaded-list-rendered

			// OUTPUT CHANNELS
			// * product-database-searched
			// * product-search-reset

			function setupSearchProducts(){

				// req vars
					var find_product, module_id, previous_value;

					module_id = "search-products";

			    // activate search
			    	product_search_input.addEventListener('input', function(e){
			    		
			    		find_product( e.target.value ); 
			    	});

					_app.subscribe("downloaded-list-rendered", module_id, function(){
						
						find_product( previous_value, true ); 
					});

				find_product = function(){

			    		var value_to_search,
			    			previous_matches;

			    		return function( search_value, force_search ){

			    			var current_value = search_value,
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
					    				(current_value === previous_value && force_search != true ) // search value matches last search
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

				    					   matched_product.markup = "<li class='product' data-attribute-dbid='" + matched_product.Id + "'>" +
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

					    							term: value_to_search,
					    							matches: cached_current_matches,
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
			    }();
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

		// MODULE: SAMPLE SEARCH

			// id: sample-search

			// REQ CHANNELS
			// * product-database-searched
			// * product-list-rendered
			// * product-search-reset

			function setupSampleSearch(data){

				var module_id = "sample-search",
					array_sort = require('stable'),
					previous_highlights = [];

				_app.subscribe_once('product-list-rendered', module_id, function(){

					var random_search_list, random_digit, search_query;

					random_search_list = ["galaxy", "lumia", "tecno", "x", "asha", "blackberry"];
					random_digit = get_random_digit();

					while( !random_search_list[random_digit] ){

						random_digit = get_random_digit();
					}

					search_query = random_search_list[random_digit];

					product_search_input.value = search_query;

	                if ("createEvent" in document) {
	                    var evt = document.createEvent("HTMLEvents");
	                    evt.initEvent("input", false, true);
	                    product_search_input.dispatchEvent(evt);
	                }
	                
	                else {

	                    product_search_input.fireEvent("oninput");
	                }
				});

				function get_random_digit(){

					var digit_src = Date.now();

					random_digit = digit_src.toString().charAt(12);

					return random_digit;
				}
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

					var alert = require('alertify').alert;

					alert('Online Ordering will be Activated on October 1, 2014');
				}
			}

		// MODULE: PRODUCT IMAGE

			// id: product-image

			// REQ CHANNELS
			// * download-product-image

			// OUTPUT CHANNELS
			// * product-state-changed

			function setupProductImage(){

				var module_id = "product-image";

				_app.subscribe('download-product-image', module_id, function(data){ 

					// required vars
						var notification, product_dom_node, product_id, image_loader, img_src, product_name, manufacturer_name;

					// get product
						notification = data.notificationParams;
						product_dom_node = notification.dom;

					// bail if product image has been loaded
						if(product_dom_node.state.imageLoaded == true){ return; }
					
					// get image url
						img_src = product_dom_node.getImgSrc(); 

					// when image loads ...
						image_loader = document.createElement("img");
						image_loader.addEventListener('load', function(){

							// update state
								product_dom_node.setState({imageLoaded: true}, function(){

									_app.publish('product-state-changed');
								});
						});

						image_loader.setAttribute('src', img_src);
				});				
			}

		// MODULE: REACT RENDER

			// id: react-render

			// REQUIRED CHANNELS
			// * product-database-searched
			// * product-search-reset

			// OUTPUT CHANNELS
			// * product-list-rendered
			// * product-is-selected
			// * product-is-deselected

			function setupReactRender(){

				var React, ReactProductList, ReactManufacturer, ReactProduct, ReactProductName, ReactProductPrice, ReactProductOrderBtn,
					div, span, header, array_sort, rendered_product_list, active_product, module_id, product_search_match_ids;

				module_id = 'react-render';

				product_search_match_ids = [];

				React = require('react');
				
				div = React.DOM.div;
				img = React.DOM.img;
				span = React.DOM.span;
				header = React.DOM.header;

				array_sort = require('stable');

				// Product List
					ReactProductList = React.createClass({

						displayName: 'product-list',

						render: function(){

							var this_product_list, manufacturer_react_nodes = [], classList = "";

							this_product_list = this;

							// add searched products to list state
								_app.subscribe('product-database-searched', module_id, function(data){

									product_search_match_ids = [];

									array_each(data.notificationParams.matches, function(match){

										product_search_match_ids.push(match.Id); 
									});

									_app.publish('search-processed-by-react');
								});

							// remove searched products from list state
								_app.subscribe('product-search-reset', module_id, function(){

									product_search_match_ids = [];
									_app.publish('search-processed-by-react');
								});

							// sort alphabetically
								manufacturer_db = array_sort( manufacturer_db, arrayAlphaSort);
							
							// for each manufacturer ...
								array_each( manufacturer_db, function(manufacturer){

									// store react manufacturer node
										manufacturer_react_nodes.push(

											ReactManufacturer({name: manufacturer.Name, dbid: manufacturer.Id})
										);
								});

							return ( div({id:"react-product-list", className: classList}, manufacturer_react_nodes) );
						}
					});
				
				// Product Manufacturer
					ReactManufacturer = React.createClass({

						displayName: 'manufacturer',
						render: function() {

								var product_react_nodes = [];

								this_manufacturer = this;

								manufacturer_id = this.props.dbid;
								manufacturer_id_model = key_model_db_json( manufacturer_db, "Id" );

								manufacturer_name = manufacturer_id_model[ manufacturer_id ].Name;

								products_grouped_by_manufacturer = is_array(products_grouped_by_manufacturer) ? products_grouped_by_manufacturer : collection_model_db_json(product_db, "ManufacturerId");

								// alphabetize the products
								products_grouped_by_manufacturer[ manufacturer_id ] = array_sort(products_grouped_by_manufacturer[ manufacturer_id ], arrayAlphaSort);

								// for each of this manufacturer's products ...
								array_each( products_grouped_by_manufacturer[ manufacturer_id ], function(product){

									// create and store react product node
									product_react_nodes.push(

										ReactProduct({name: product.Name, dbid: product.Id, price: product.WholesalePrice, manufacturer: manufacturer_name})
									);
								});

						    return (

						        div({className: "manufacturer"},
						          	
						          	header({dbid: this.props.dbid }, this.props.name), 
						          	product_react_nodes
						        )
							);
						}  
					});

				ReactProduct = React.createClass({

					displayName: 'product',

					getInitialState: function(){

						return {active: false, imageLoaded: false, searchMatch: false};
					},

					getImgSrc: getProductImageSrc,

					clickHandler: function(e){

						var this_product, dbid;

						this_product = this;
						dbid = this_product.props.dbid;

						if (this_product.state.active == true){

							// deactivate product
								this_product.setState({active: false}, function(){

									_app.unsubscribe('product-is-selected', 'deselect-previous-product');
									
				           			_app.publish('product-is-deselected', { 'dom': this_product, 'database_id': dbid });
									_app.publish('product-state-changed');
								});
			           	}

						else {

							this_product.setState({active: true}, function(){
			            		
			            		_app.publish('product-is-selected', { 'dom': this_product, 'database_id': dbid });
								_app.publish('product-state-changed');

								// setup deactivate listener
				            		setTimeout(function(){

				            			_app.subscribe_once('product-is-selected', 'deselect-previous-product', function(data){

											this_product.setState({ active: false }, function(){

												_app.publish('product-state-changed');
											});
										});
				            		}, 0);								
							});
						}

						e.stopPropagation();
					},

					render: function() {

						var this_product = this,
							
							react_product_name_object,
							react_product_price_object,
							react_product_image_object,
							react_product_order_btn,
							
							classList, 
							
							product_id = this.props.dbid,
							product_id_model = is_array(product_id_model) ? product_id_model : key_model_db_json(product_db, "Id"),
							product_name = product_id_model[ product_id ].Name,
							product_price = product_id_model[ product_id ].WholesalePrice,

							manufacturer_name = this.props.manufacturer;

						classList = "product";

						_app.subscribe('search-processed-by-react', 'react-product-' + product_id, function(){

							if( product_search_match_ids.indexOf(product_id) > -1 && this_product.state.searchMatch != true){

								this_product.setState({ searchMatch: true });
							}

							else if( product_search_match_ids.indexOf(product_id) == -1 && this_product.state.searchMatch != false){

								this_product.setState({ searchMatch: false });
							}
						});
							
						if( this.state.searchMatch ){

							classList += " search-result";
						}

						if( this.state.active ){

							// add class to dom element
								classList += " active";

							// load product order btn
								react_product_order_btn = ReactProductOrderBtn();

		            		// render image if loaded
								if( this.state.imageLoaded ){

									react_product_image_object = ReactProductImage({dbid: product_id});
								}

							// download if it hasn't
								else{

									_app.publish('download-product-image', {'dom': this_product});
								}
						}

						react_product_name_object = ReactProductName({name: product_name, manufacturer: manufacturer_name, isProductActive: this.state.active});
						react_product_price_object = ReactProductPrice({price: product_price});

					    return ( 

					    	div({className: classList, onClick: this_product.clickHandler},				         
				          	
					          	react_product_name_object,
					          	react_product_image_object,			          	
					          	react_product_price_object,
					          	react_product_order_btn
					        )
				        );
					}  
				});

				ReactProductName = React.createClass({

					displayName: 'name',
					render: function() {

						var product_display_name = (this.props.isProductActive ? this.props.manufacturer + " " : '') + this.props.name;

					    return ( div({className: "name"}, product_display_name) );
					}  
				});

				ReactProductImage = React.createClass({

					displayName: 'image',

					getImgSrc: getProductImageSrc,

					render: function() {

						var img_src = this.getImgSrc();

					    return (
					        div({className: "image collapsed"}, 

					        	img({src: img_src})
					        )
						);
					}  
				});

				ReactProductPrice = React.createClass({

					displayName: 'price',
					render: function() {

						var price = this.props.price;

					    return (
					        div({className: "wholesale-price"},				         
					          	
					          	span({className: "currency"}, String.fromCharCode(8358) ),
					          	price
					        )
						);
					}  
				});

				ReactProductOrderBtn = React.createClass({

					displayName: 'order-product',
					clickHandler: function(e){

						var alert = require('alertify').alert;    

		                alert('Ordering Online Will Be Activated October 1st', function(){}, 'alertify-warning');

						e.stopPropagation();
					},

					render: function(){

						var this_btn = this;

						return (

							div({className: "order-product", onClick: this_btn.clickHandler}, "order")
						);
					}
				});

				render_react_product_list = function(){

					rendered_product_list = React.renderComponent(
						
						ReactProductList(),								
						product_list,
						function(){

							var react_product_list = document.getElementById('react-product-list'); 

							_app.publish('product-list-rendered', react_product_list, module_id);
						}
					);					
				}

				function getProductImageSrc(){

						var product_id, product_name, manufacturer_name;

						product_id = this.props.dbid;

						product_id_keystore = is_array(product_id_keystore) ? product_id_keystore : key_model_db_json(product_db, "Id"); 
						manufacturer_id_keystore = is_array(manufacturer_id_keystore) ? manufacturer_id_keystore : key_model_db_json(manufacturer_db, "Id"); 
						
						product = product_id_keystore[ product_id ];

						product_name = product.Name;
						manufacturer_name = manufacturer_id_keystore[ product.ManufacturerId ].Name;

						return "http://res.cloudinary.com/hrowcuozo/image/upload/t_svelte/" + manufacturer_name.toLowerCase() + "-" + product_name.toLowerCase().replace(/ /g, "-").replace(/%20/g, "-") + ".jpg";
				} 
			}

		// MODULE: MASONRY LAYOUT

			// id: masonry-layout

			function setupMasonryLayout(){

				var module_id = 'masonry-layout';

				_app.subscribe_once('product-list-rendered',  'setup-' + module_id, function(data){

					var product_list_wrapper = data.notificationParams,
						sample_manufacturer_node = product_list_wrapper.getElementsByClassName('manufacturer')[0];

				// activate masonry
					pricelist_masonry = new Masonry( product_list_wrapper, {

						"columnWidth": sample_manufacturer_node,
						"containerStyle": null
					});

				// relayout masonry
					var relayout_masonry = function(){ var masonry = pricelist_masonry; return function(){ masonry.layout(); }}()

					pricelist_masonry.bindResize();

				// bind relayout to key events
					_app.subscribe('product-list-rendered', 'masonry-js', relayout_masonry);
					_app.subscribe('product-state-changed', 'masonry-js', relayout_masonry);
					_app.subscribe('product-animation-completed', 'masonry-js', relayout_masonry);
				});
			}

		// DOWNLOAD AND RENDER PRODUCT LIST

			// OUTPUT CHANNELS
			//	* server-not-reached	
			//	* downloaded-list-rendered	
			//	* offline-databases-updated	

			function download_and_render_product_list(){

				// required vars
					var requested_product_json,
					requested_manufacturer_json,
					download_timestamp,

					pending_requests = 2;

				// get product json from server
					HTTP_POST(
						'http://fathomless-atoll-7008.herokuapp.com/get-product.php',
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
						'http://fathomless-atoll-7008.herokuapp.com/get-manufacturer.php',
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
						render_react_product_list();

						_app.publish('downloaded-list-rendered');

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
								render_react_product_list();
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

	
	// APP GLOBAL FUNCTIONS
	// ---------------------

		// setup app
			function setup_app(){

				// OFFLINE STORAGE
	    			setupDeviceStorage();

	    		// CACHE DOM NODE LOOKUPS
					setupDOMQueryCache();

				// REMOVE TOUCH INPUT DELAY
			    	setupRemoveTouchDelay();

			    // PRODUCT SEARCH + RELATED FEATURES
				    setupSearchProducts();
					setupSampleSearch();

				// ACTIVATE HEADER MENU
					setupMainMenu();

				// PRODUCT LIST
					setupReactRender();
					setupProductImage();
					setupMasonryLayout();
				//	setupProductOptions();

				_app.publish('app-setup-complete');
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


	// 	DEPRECATED CODE	 	
	//	--------------------
	//	* TODO: remove all references / associated references for these modules


}());