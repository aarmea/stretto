Setting up frontend dependencies
================================

On the frontend, Stretto uses [jQuery](http://jquery.com/) and [ringw's fork of
VexFlow with MusicXML support](https://github.com/ringw/vexflow).

1. Download and install [Bower](http://bower.io/).
2. Download the dependencies with `bower install`.
3. This version of VexFlow does not come with minified JavaScript. Generate it
   by following
   [their instructions](https://github.com/0xfe/vexflow/wiki/Build-Instructions)
   inside VexFlow's directory (`frontend/bower_components/vexflow`).

Running the demo
================

To quickly run the demo without starting a dedicated server:
1. Run `python -m SimpleHTTPServer`.
2. Navigate to <http://localhost:8000/demo.html>.
