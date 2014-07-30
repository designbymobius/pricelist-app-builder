(function(){

	// ON INIT
	// -------- 

	// required vars
		var pubsub = dxmPubSub,
		product_json,
		manufacturer_json,

		product_db,
		manufacturer_db,
		products_grouped_by_manufacturer,

		deviceStorage,

		viewport,
		collapsible_sections,
		active_collapsible,

		about_page_section,
		about_page_section_subheader,

		product_search_input;

	// set appcache listeners

		setAppcacheListener();

        function setAppcacheListener(){

            if (window.applicationCache){

                window.applicationCache.addEventListener('updateready', cacheReady);
                ga('send','event','offline-db','capable', 'true');
            }
            
            // new cache ready
                function cacheReady(){     

                    alert('Update Installed! Restarting App Now');
                    window.applicationCache.swapCache();
                    location.reload(true);
                }
        };

    // create device datastore - available offline

    	createDeviceStorage();

        function createDeviceStorage(){

            deviceStorage = new Persist.Store('Pricing App Storage', {

                about: "Data Storage to enhance Offline usage",
                path: location.href
            });
        }

	// cache dom queries
		viewport = document.getElementById('viewport');
		collapsible_sections = viewport.getElementsByClassName('collapsible');

		about_us_section = document.getElementById('about-us');
		about_page_section = document.getElementById('about-page');
		about_page_section_subheader = about_page_section.getElementsByClassName('subtitle')[0];

		search_products_section = document.getElementById('search-products');
		product_search_input = document.getElementById('product-search-input');
		search_products_section_subheader = search_products_section.getElementsByClassName('subtitle')[0];
		product_search_results_section = search_products_section.getElementsByClassName('content')[0]

	// open about-page section
    	addClass(about_page_section, "active");
    	active_collapsible = about_page_section;

    // activate search
    	product_search_input.addEventListener('input', function(){

    		var value_to_search,
    			previous_value,
    			previous_total,
    			search_buffer;

    		return function(e){

    			var current_value = e.target.value,
    				search_start_time,
    				search_duration,
    				product_name_search_results,
    				manufacturer_name_search_results,
    				matched_manufacturer_id_array = [];

    			if(typeof search_buffer != 'undefined'){ clearTimeout(search_buffer); }

    			search_buffer = setTimeout(do_search, 222);

    			value_to_search = current_value.toLowerCase();

    			function do_search(){

    				// required vars
    					var markup_to_render = "";

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
		    				previous_total = "";

		    				product_search_results_section.innerHTML = "";
		    				search_products_section_subheader.innerHTML = "";

							removeClass(product_search_results_section, "populated");
							removeClass(product_search_results_section, "unique-match");
							removeClass(product_search_results_section, "even-length-querystring");

		    				return;
		    			}

	    			search_start_time = Date.now();

	    			// search manufacturers
	    				manufacturer_db = ( Object.prototype.toString.call(manufacturer_db) === "[object Array]" ? manufacturer_db : JSON.parse(manufacturer_json));
		    			manufacturer_name_search_results = search_array(
		    				
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
	    				product_db = ( Object.prototype.toString.call(product_db) === "[object Array]" ? product_db : JSON.parse(product_json));
		    			product_name_search_results = search_array(
		    				
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
	    				product_name_search_results.sort(function(a,b){

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

	    					var total_previous_matches = previous_total,
	    						total_current_matches = product_name_search_results.length;

	    					return function(){

								if(product_name_search_results.length > 0){

									addClass(product_search_results_section, "populated");
								}

								else {

									removeClass(product_search_results_section, "populated");
								}

								if(total_current_matches !== total_previous_matches){

									if(value_to_search.length % 2 == 0){

										addClass(product_search_results_section, "even-length-querystring");
									}

									else {
										
										removeClass(product_search_results_section, "even-length-querystring");
									}

									if(total_current_matches === 1){

										addClass(product_search_results_section, "unique-match");
									}

									else {

										removeClass(product_search_results_section, "unique-match");
									}
								}

			    				product_search_results_section.innerHTML = markup_to_render;
			    				search_products_section_subheader.innerHTML =  product_name_search_results.length + " match" + (product_name_search_results.length > 1 ? "es" : "") + "<span class='expanded'> for \"" + value_to_search + "\"</span>";						
	    						var search_total_duration = Date.now() - search_start_time - 8

	    						console.log( "search + render duration of '" + value_to_search + "' search: " + search_total_duration + "ms" );

	    						if(search_total_duration > 8){

	    							ga('send','event','slow-search','log', { 'key': value_to_search, 'duration': search_total_duration});
	    						}
	    					}

	    				}(), 8);

	    			previous_value = value_to_search;
	    			previous_total = product_name_search_results.length;
    			}
    		}
    	}());

	// activate header menu
		viewport.addEventListener("click", function(e){

			var click_target = e.target,
				array_of_focal_elements;

			// filter events that arent from the product list
                while( !hasClass(click_target, "collapsible") && click_target != viewport ){

                    if( click_target.parentNode == screen || click_target.parentNode == document.body ){ return; }
                    click_target = click_target.parentNode;
                }

            	if(click_target === viewport || click_target === active_collapsible){ return; }

            	if(typeof active_collapsible != "undefined" || active_collapsible != null){

            		removeClass(active_collapsible, "active");
            	}

            	addClass(click_target, "active");
            	active_collapsible = click_target;

            	array_of_focal_elements = click_target.getElementsByClassName('focal-element');
            	if(array_of_focal_elements.length > 0){

            		array_of_focal_elements[0].focus();
            	}

            	ga('send','event','section-view', click_target.id );
		});

	// check for cached prices

		render_cached_product_list();

		function render_cached_product_list(){

			var cached_product_json,
				cached_manufacturer_json,

				cached_product_db,
				cached_manufacturer_db,

				cache_prime_checks_remaining = 2;

			deviceStorage.get('product', function(ok, cache){

				try{

					var cache_to_json = JSON.parse(cache);
				}

				catch(e){

					cache_to_json = false;
				}

				if(cache_to_json != false){
				
					cached_product_json = cache;
					cached_product_db = cache_to_json;
				}

				cache_prime_checks_remaining -= 1;
				is_cache_loaded();
			});

			deviceStorage.get('manufacturer', function(ok, cache){

				try{

					var cache_to_json = JSON.parse(cache);
				}

				catch(e){

					cache_to_json = false;
				}

				if(cache_to_json != false){

					cached_manufacturer_json = cache;
					cached_manufacturer_db = cache_to_json;
				}

				cache_prime_checks_remaining -= 1;
				is_cache_loaded();
			});

			function is_cache_loaded(){

				if(typeof cached_manufacturer_json == "undefined" || typeof cached_product_json == "undefined"){

					if(cache_prime_checks_remaining > 0){

						return;
					}

					else {

						cache_loading_complete();
					}
				}

				deviceStorage.get('cache-timestamp', function(ok, timestamp){

					if(typeof timestamp != "undefined" && timestamp != null){ 

						var cache_date = get_beautified_date( parseInt(timestamp) ),
							cache_age = parseInt(Date.now().toString()) - cache_date;
						
						product_json = cached_product_json;
						product_db = cached_product_db;

						products_grouped_by_manufacturer = collection_model_db_json(product_db, 'ManufacturerId');

						manufacturer_json = cached_manufacturer_json;
						manufacturer_db = cached_manufacturer_db;

						about_page_section_subheader.innerHTML = (cache_date ? "<span class='collapsed'>" + cache_date + " - </span><span class='attention'>saved data</span>" : "Prices From last download" );				
						render_product_list();

						ga('send','event','offline-db', 'loaded','cache-age', cache_age );
					}

					else {
						
						about_page_section_subheader.innerHTML = "Downloading prices";				
					}

					cache_loading_complete();
				});
			}

			function cache_loading_complete(){
				
				// announce and start downloading prices
					download_and_render_product_list();
			}
		}

	// download and render product list
		function download_and_render_product_list(){

			// required vars
			var requested_product_json,
				requested_manufacturer_json,
				download_timestamp,

				remaining_request_fails = 2;

			// get product json from server
				HTTP_POST(
					'http://pricingapp.designbymobi.us/get-product.php',
					null,
					function(data){

						if(!is_json(data)){

							remaining_request_fails -= 1;
						} 

						// bind received json to instance product json
						else{

							requested_product_json = data;
						}

						if(all_metadata_loaded()){

							render_new_data();
						}
					},
					function(){

						remaining_request_fails -= 1;
					}
				);

			// get manufacturer json from server
				HTTP_POST(
					'http://pricingapp.designbymobi.us/get-manufacturer.php',
					null,
					function(data){

						if( !is_json(data) ){

						 	remaining_request_fails -= 1;
						}

						// store received json to instance product json 
						else {
							
							requested_manufacturer_json = data;
						}


						if(all_metadata_loaded()){

							render_new_data();
						}
					},
					function(){

						remaining_request_fails -= 1;
					}
				);

			function render_new_data(){

				// required vars
					product_json = requested_product_json;
					manufacturer_json = requested_manufacturer_json;
					download_timestamp = JSON.stringify(Date.now());

				// store to device
					deviceStorage.set('product', requested_product_json);
					deviceStorage.set('manufacturer', requested_manufacturer_json);
					deviceStorage.set('cache-timestamp', download_timestamp);

					ga('send','event','offline-db','updated','timestamp', download_timestamp);

				// group products by manufacturer
					products_grouped_by_manufacturer = collection_model_db_json(product_json, 'ManufacturerId');

				// alphabetically sort
					manufacturer_db = JSON.parse(manufacturer_json);

				// do rendering
					render_product_list();
					about_page_section_subheader.innerHTML = "<span class='collapsed'>" + get_beautified_date() + " - </span><span class='confirmation'>current prices</span>";
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

				remaining_request_fails -= 1;

				if(remaining_request_fails < 1){

					ga('send','event','ajax','server-not-reached');
				}
			}
		}


	
	// APP GLOBAL FUNCTIONS
	// ---------------------

	// render product list
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
				manufacturer_nodes;

			// alpha sort manufacturers
				manufacturer_db.sort(arrayAlphaSort);

			// iterate over manufacturer list
				for(var i = manufacturer_db.length; i >= 1; i -= 1 ){

					// set current manufacturer and details
						current_manufacturer_index = manufacturer_db.length - i;
						current_manufacturer = manufacturer_db[ current_manufacturer_index ];
						current_manufacturer_has_listable_product = false;

					// add div.manufacturer and .manufacturer header to markup
						markup += "<div class='manufacturer' data-attribute-dbid='" + current_manufacturer.Id + "'>" +
							  		"<header>" + current_manufacturer.Name + "</header>";

					// alphabetically sort current manufacturer's products
						current_manufacturer_products = products_grouped_by_manufacturer[ current_manufacturer.Id ];
						current_manufacturer_products.sort(arrayAlphaSort);			

					// iterate over current manufacturer's products
						for (var ii = current_manufacturer_products.length; ii >= 1; ii--) {

							// set current product
								current_product = current_manufacturer_products[current_manufacturer_products.length - ii];

							// filter products with no wholesale price
								if(!current_product.WholesalePrice || typeof current_product.WholesalePrice == "undefined" || current_product.WholesalePrice == null){ continue; }
							
							// listable product for this manufacturer found
								if(!current_manufacturer_has_listable_product){ current_manufacturer_has_listable_product = true; }

							// add product to markup
								markup += "<div class='product' data-attribute-dbid='" + current_product.Id + "'>" + 
											"<div class='name'>" + current_product.Name + "</div>" +
											"<div class='wholesale-price'><span class='currency'>&#8358;</span>" + current_product.WholesalePrice + "</div>" +
										  "</div>";
						};

					// close div.manufacturer in markup
						markup += "</div>";

					// if manufacturer is empty, note it
						if(current_manufacturer_has_listable_product != true){
							
							empty_manufacturers_index_array.push(current_manufacturer_index);
						}
				}

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

			// activate masonry
				pricelist_masonry = new Masonry( container );
				pricelist_masonry.bindResize();
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
		function search_array(array_to_search, search_function, on_match){

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

				processing_function( current_item );
			}
		}    

    // model db by collection
        function collection_model_db_json( db_json, key ){

            var db,
                modelled_db = {};

            if(Object.prototype.toString.call( db_json ) === "[object Array]"){

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

            if(Object.prototype.toString.call( db_json ) === "[object Array]"){

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

	        a = a.Name.toLowerCase();
	        b = b.Name.toLowerCase();

	        if(a > b){ return 1; }
	        else if(b > a){ return -1; }
	        else { return 0; }
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
}());