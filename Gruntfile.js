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
							core: ["temp/js/scripts.min.js"]
						},

						styles: {
							base: ["temp/css/style.min.css"]
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

			browserify: {

				app:{

					src: ['src/js/persist.min.js', 'src/js/cjs-pubsub.js'],
					plugin: ['moment', 'morpheus', 'prop-search', 'stable', 'fastclick'],
					dest: 'bin/js/browserified.js'
				}
			},

			copy: {

				app: {

					files: [
						{
							
							src: ['*'],
							dest: 'bin/font',
							cwd: './src/font/',
							expand: true
						}
					]
				},

				server: {

					files: [
						{
	
							src: ['.htaccess', 'composer.json', 'Procfile'],
							dest: 'bin/',
							cwd: './src/',
							expand: true
						}
					]
				}
			},

			concat: {

				css: {

					src: ['src/css/*'],
					dest: 'temp/css/style.css'
				},

				js: {

					src: ['src/js/browserified.js', 'src/js/masonry.min.js', 'src/js/behavior.js'],
					dest: 'temp/js/scripts.js'
				} 
			},

			cssmin: {

				app: {
					
					src: 'temp/css/style.css',
					dest: 'temp/css/style.min.css'
				}
			},

			uglify: {

				app: {

					src: 'temp/js/scripts.js',
					dest: 'temp/js/scripts.min.js'
				}
			},

			clean: ['temp']
	});

	// ACTIVATE PLUGINS

		grunt.loadNpmTasks('grunt-contrib-concat');
		grunt.loadNpmTasks('grunt-contrib-cssmin');
		grunt.loadNpmTasks('grunt-contrib-uglify');
		grunt.loadNpmTasks('grunt-contrib-clean');
		grunt.loadNpmTasks('grunt-contrib-copy');
		grunt.loadNpmTasks('grunt-browserify');
		grunt.loadNpmTasks('grunt-html-build');
		grunt.loadNpmTasks('grunt-manifest');


	// REGISTER TASKS

		grunt.registerTask('prep-css', ['concat:css', 'cssmin']);
		grunt.registerTask('prep-js', ['browserify', 'concat:js', 'uglify']);
		grunt.registerTask('build', ['prep-css', 'prep-js', 'htmlbuild', 'copy', 'manifest', 'clean']);
}