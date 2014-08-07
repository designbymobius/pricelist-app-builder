// PROJECT BLACKBOX


	module.exports = function(){
		
		// PUBSUB INTERNALS
		// Publishers announce when an event of note has occured
		// Subscribers react when they get the announcement of the change

		// Prototype
			var codec = {
		
				/* SUBSCRIBE */
					subscribe: function(notification, subscriber, response, responseParams){
						
						// if the list of subscribers for this notification doesn't exist, create it
							if (!this.subscribers[notification]) { this.subscribers[notification] = {}; }
						
						// get list of subscribers to this notification
							var subscriberList = this.subscribers[notification];
						
						// add subscriber to the list with function of what they do in response, with params if needed
							subscriberList[subscriber] = {}
							subscriberList[subscriber].response = response;
							subscriberList[subscriber].responseParams = responseParams || null;
						
						// update log
							this.log.push({"type": "subscribe", "notification": notification, "subscriber": subscriber});			
					},
		
				/* UNSUBSCRIBE */
					unsubscribe: function (notification, subscriber) {
						
						// if the subscription list DNE or subscriber isn't on the list, exit
						if (!this.subscribers[notification] || !this.subscribers[notification][subscriber]) {
							return;
						}
						
						// unsubscribe
						delete this.subscribers[notification][subscriber];
						
						// update log
						this.log.push({"type": "unsubscribe", "notification": notification, "unsubscriber": subscriber});				
					},
		
				/* PUBLISH */
					publish: function (notification, notificationParams, publisher) {

						var _self = this;
						
						// if there are no subscribers, exit
						if (!_self.subscribers[notification]) {
							return;
						}

						publisher = publisher || "unidentified";
						
						// required vars
						var subscriberList = _self.subscribers[notification],
							informedSubscribers = [];

						
						for (var subscriber in subscriberList) {
							
							
							var params = {};
							params.notificationParams = notificationParams || null;
							params.responseParams = _self.subscribers[notification][subscriber].responseParams || null;
							
							// inform subscriber in a separate thread 
							setTimeout( (function(subscriber, params) { 
								return function() {
									subscriberList[subscriber].response(params);
								} 
							})(subscriber, params), 0 );
							
							// keep track of who has been informed
							informedSubscribers.push(subscriber);							
						}
						
						// update log 
						_self.log.push({"type": "publish", "notification": notification, "informedSubscribers": informedSubscribers, "publisher": publisher});

						if(_self.settings.consoleLog !== false){

							console.log('Published: ' + notification + '\n Publisher: ' + publisher +  '\n Informed: ' + JSON.stringify(informedSubscribers) );
							console.log("----------------------\n");
						}		
					},

				/* SUBSCRIBE ONCE */
				    subscribe_once: function(notification, subscriber, response, responseParams){

				    	var _self = this;				            	
				        

				        _self.subscribe(
				            notification, 
				            subscriber,

				            function(data){

			                	response(data);
			                	_self.unsubscribe(notification,subscriber);
			            	},

				            responseParams
				        );
				    }
			}
		
		// Constructor
			function ReconUnit(settings){

				// set default values
					this.settings = settings || { consoleLog: false };
					this.subscribers = [];
					this.log = [];
			}

			ReconUnit.prototype = codec;
			ReconUnit.prototype.constructor = ReconUnit;

			return ReconUnit; 
	}();