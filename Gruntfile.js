module.exports = function(grunt){
	
	grunt.initConfig({

		// BUILD-REQUIRED VARS

			css_libs: [ "src/css/icon-font.css" ],

			css_main: "src/css/style.css",

		// CONFIGURE PLUGINS

			htmlbuild: {

				app: {

					src: "src/index.html",
					dest: "bin/index.html",
					options: {

						scripts: {
							core: ["temp/js/browserified.min.js"]
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
						basePath: "src/",
						fallback: ["/ index.html"],
						network: [	
							
							"http://res.cloudinary.com", 
							"http://www.google-analytics.com", 
							"http://fathomless-atoll-7008.herokuapp.com"
						],
				        timestamp: true,
				        verbose: false,
				        preferOnline: false
					},				
					src: ['index.html', "js/masonry.*", "font/icomoon.*"],
					dest: 'bin/manifest.appcache'
				}
			},

			browserifying: {

				app: {
					
					files: {

						'./temp/js/browserified.js': './src/js/behavior.js'
					}
				},

				options: {

					watch: false,
					sourceMaps: false,
					map: {
						'persist': { exports: 'Persist', path: "./src/js/persist.min.js" },
						'alertify': { exports: 'alertify', path: "./node_modules/alertify/lib/alertify.min.js" }
					}
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
						},

						{
							
							src: ['masonry.min.js'],
							dest: 'bin/js',
							cwd: './src/js/',
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
				},

				debug: {

					files: [
						{

							src: ['browserified.js'],
							dest: './temp/js/',
							cwd: './temp/js/',
							ext: ".min.js",
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

					src: ['src/js/browserified.js', 'src/js/behavior.js'],
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

				options: {

					mangle: false
				},

				app: {

					files: {

						'temp/js/browserified.min.js': ['temp/js/browserified.js']
					}
				}
			},

			clean: ['temp']
	});

	// ACTIVATE PLUGINS

		grunt.loadNpmTasks('grunt-contrib-concat');
		grunt.loadNpmTasks('grunt-contrib-cssmin');
		grunt.loadNpmTasks('grunt-contrib-uglify');
		grunt.loadNpmTasks('grunt-contrib-clean');
		grunt.loadNpmTasks('grunt-browserifying');
		grunt.loadNpmTasks('grunt-contrib-copy');
		grunt.loadNpmTasks('grunt-html-build');
		grunt.loadNpmTasks('grunt-manifest');


	// REGISTER TASKS

		grunt.registerTask('prep-css', ['concat:css', 'cssmin']);
		grunt.registerTask('prep-debug-js', ['browserifying:app']);
		grunt.registerTask('prep-js', ['prep-debug-js', 'uglify:app']);

		grunt.registerTask('build', ['prep-css', 'prep-js', 'htmlbuild', 'copy:app', 'copy:server', 'manifest', 'clean']);
		grunt.registerTask('build-debug', ['prep-css', 'prep-debug-js', 'copy', 'htmlbuild', 'manifest', 'clean']);
}