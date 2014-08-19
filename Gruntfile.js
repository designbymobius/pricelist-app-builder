module.exports = function(grunt){
	
	grunt.initConfig({

		// BUILD-REQUIRED VARS

			js_libs: [

				"src/js/masonry.min.js",
				"src/js/browserified.js"
			],

			js_main: "src/js/behavior.js",

			css_libs: [ "src/css/icon-font.css" ],

			css_main: "src/css/style.css",

		// CONFIGURE PLUGINS

			htmlbuild: {

				app: {

					src: "src/index.html",
					dest: "bin/index.html",
					options: {

						scripts: {
							core: ["<%= js_libs %>", "<%= js_main %>"]
						},

						styles: {
							base: ["<%= css_libs %>", "<%= css_main %>"]
						}
					}
				}
			},

			manifest: {

				app: {
					
					options: {
						basePath: "bin/",
						fallback: ["/ index.html"],
						network: [	
									"http://res.cloudinary.com", 
									"http://www.google-analytics.com", 
									"http://pricingapp.designbymobi.us", 
									"http://fathomless-atoll-7008.herokuapp.com"
								],
				        timestamp: true,
				        verbose: false,
					},				
					src: ['index.html', "<%= css_libs %>", "<%= css_main %>", "<%= js_libs %>", "<%= js_main %>"],
					dest: 'bin/manifest.appcache'
				}
			},
	});

	// ACTIVATE PLUGINS

		grunt.loadNpmTasks('grunt-html-build');
		grunt.loadNpmTasks('grunt-manifest');


	// REGISTER TASKS

		grunt.registerTask('build', ['htmlbuild', 'manifest']);
}