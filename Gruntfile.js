module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-s3');
  grunt.loadNpmTasks('grunt-pg-db');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    pgdb: {
      options: {
          connection: 'postgres://localhost:5432',
          sql: [
              "CREATE DATABASE test",
              "CREATE ROLE testuser WITH LOGIN PASSWORD 'test'",
              "GRANT ALL PRIVILEGES ON DATABASE test TO testuser",
              "ALTER ROLE test CREATEDB"
          ]
        }
      },

    sass: {
      dist: {
          files: {
              './client/dist/style/reviews.css' : './client/dist/style/sass-style.scss'
          }
      }
    },

    watch: { // Compile everything into one task with Watch Plugin
      css: {
        files: './client/dist/style/*.scss',
        tasks: ['sass','s3']
      },
      express: {
        files:  [ 'server/*.js' ],
        tasks:  [ 'express:main', 'express:proxy' ],
        options: {
          spawn: false 
        }
      },
      react: {
        files: ['client/components/*.jsx', 'client/app.jsx'],
        tasks: ['webpack:build','s3']
      }
    },

    express: {
      main: {
        options: {
          script: 'server/index.js'
        }
      },
      proxy: {
        options: {
          script: 'server/proxy.js'
        }
      }
    },

    webpack: {
      build: {
        entry: [__dirname + '/client/src/app.jsx'],
        output: {
          path: __dirname + '/client/dist/',
          filename: 'bundle.js'
        },
        stats: {
          colors: false,
          modules: true,
          reasons: true
        },
        storeStatsTo: 'webpackStats',
        progress: true,
        failOnError: true,
        watch: true,
        performance: {
          hints: process.env.NODE_ENV === 'production' ? "warning" : false
        },
        module: {
          rules: [
              { 
                  test: [/\.jsx$/],
                  exclude: /node_modules/,
                  use: {
                      loader: 'babel-loader',
                      options: {
                          presets: ['@babel/preset-react', '@babel/preset-env']
                      }
                  }
              }
          ]
        },
        mode: 'production'
      }
    },

    aws: grunt.file.readJSON('./grunt-aws.json'),
    s3: {
      options: {
        key: '<%= aws.key %>',
        secret: '<%= aws.secret %>',
        bucket: '<%= aws.bucket %>',
        access: 'public-read',
        headers: {
          // Two Year cache policy (1000 * 60 * 60 * 24 * 730)
          "Cache-Control": "max-age=630720000, public",
          "Expires": new Date(Date.now() + 63072000000).toUTCString()
        }
      },
      dev: {
        // Files to be uploaded.
        upload: [
          {
            src: 'client/dist/bundle.js',
            dest: 'bundle_cr.js',
  
            // These values will override the above settings.
            bucket: '<%= aws.bucket %>',
            access: 'authenticated-read'
          },
          {
            src: 'client/dist/style/reviews.css',
            dest: 'cr_style.css',
  
            // These values will override the above settings.
            bucket: '<%= aws.bucket %>',
            access: 'authenticated-read'
          }
        ],
  
        sync: [
          {
            // make sure this document is newer than the one on S3 and replace it
            verify: true,
            src: 'client/dist/bundle.js',
            dest: 'bundle_cr.js',
          },
          {
            // make sure this document is newer than the one on S3 and replace it
            verify: true,
            src: 'client/dist/style/reviews.css',
            dest: 'cr_style.css',
          }
        ]
      }
    }
  });

  grunt.registerTask('default', ['sass', 'express:main','express:proxy','webpack:build','s3','pgdb','watch']);
};