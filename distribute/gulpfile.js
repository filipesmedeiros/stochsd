const gulp = require('gulp');
const useref = require('gulp-useref');
const rename = require('gulp-rename');
const process = require('process');

// gulp 5's vinyl-fs defaults to transcoding every file through UTF-8 (both on
// read and write), which silently corrupts binary files (PNGs, icons, etc).
// Passing this to every gulp.src()/gulp.dest() call disables that and copies
// raw bytes instead. See https://github.com/gulpjs/vinyl-fs#optionsencoding
const RAW = { encoding: false };

function getStochSDVersion() {
	var fs = require("fs");
	process.chdir(__dirname)
	var content = fs.readFileSync('../OpenSystemDynamics/src/version.js', 'utf8');
	eval(content);
	return stochsd.version;
}

gulp.task('default' , function(done) {
	// The difference between the web build and the desktop build is that the
	// web build compresses everything to one single .js file to load faster
	// over the web. The desktop build runs the code as-is, unbundled, which
	// makes it easier to debug — and is what electron-builder packages.

	const StochSDVersion = getStochSDVersion()
	console.log("Building StochSD version ", StochSDVersion);

	process.chdir(__dirname +'/..');
	buildForWeb("distribute/output/web/"+StochSDVersion+"/");
	buildForDesktop("distribute/output/app/");
	copyLicenses("distribute/output/");

	// https://stackoverflow.com/questions/36897877/gulp-error-the-following-tasks-did-not-complete-did-you-forget-to-signal-async
	done();
});

function copyLicenses(destFolder) {
	// License
	gulp.src('OpenSystemDynamics/src/license.html', RAW)
	.pipe(gulp.dest(destFolder, RAW));

	// Third party licenses
	gulp.src('OpenSystemDynamics/src/third-party-licenses.html', RAW)
	.pipe(gulp.dest(destFolder, RAW));
}

function buildForDesktop(destFolder) {

	// License
	gulp.src('LICENSE.txt', RAW)
	.pipe(gulp.dest(destFolder, RAW));

	// Launcher
	gulp.src('start.html', RAW)
	.pipe(gulp.dest(destFolder, RAW));

	// package.json. Needed for running "electron ." in the output folder, and
	// read by electron-builder when packaging it.
	gulp.src('package.json', RAW)
	.pipe(gulp.dest(destFolder, RAW));

	// Electron main process + preload bridge
	gulp.src('electron/**', RAW)
	.pipe(gulp.dest(destFolder+'/electron', RAW));

	// OpenSystemDynamics
	gulp.src('OpenSystemDynamics/**', RAW)
	.pipe(gulp.dest(destFolder+'/OpenSystemDynamics', RAW));

	// icons
	gulp.src('icons/**', RAW)
	.pipe(gulp.dest(destFolder+'/icons', RAW));

	// MultiSimulationAnalyser
	gulp.src('MultiSimulationAnalyser/**', RAW)
	.pipe(gulp.dest(destFolder+'/MultiSimulationAnalyser', RAW));
}

function buildForWeb(destFolder) {

	// icons
	gulp.src('icons/**', RAW)
	.pipe(gulp.dest(destFolder+'/icons', RAW));

	// Launcher
	gulp.src('start.html', RAW)
	.pipe(rename('index.html'))
	.pipe(gulp.dest(destFolder, RAW));

	// Webapp
	gulp.src('MultiSimulationAnalyser/multisimulationanalyser-manifest.json', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/', RAW));

	gulp.src('MultiSimulationAnalyser/multisimulationanalyser-serviceworker.js', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/', RAW));

	gulp.src('MultiSimulationAnalyser/stochsd-128.png', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/', RAW));

	gulp.src('MultiSimulationAnalyser/stochsd-256.png', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/', RAW));

	// OpenSystemDynamics
	gulp.src('OpenSystemDynamics/src/*.html', RAW)
	.pipe(useref())
	.pipe(gulp.dest(destFolder+'OpenSystemDynamics/src', RAW));

	gulp.src('OpenSystemDynamics/src/graphics/**', RAW)
	.pipe(gulp.dest(destFolder+'OpenSystemDynamics/src/graphics', RAW));

	gulp.src('OpenSystemDynamics/src/jquery/jquery-ui-1.12.1/images/**', RAW)
	.pipe(gulp.dest(destFolder+'OpenSystemDynamics/src/images', RAW));

	// MultiSimulationAnalyser
	gulp.src('MultiSimulationAnalyser/index.html', RAW)
	.pipe(useref())
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser', RAW));

	// Make standalone.html for PWA web app
	gulp.src('MultiSimulationAnalyser/index.html', RAW)
	.pipe(rename('standalone.html'))
	.pipe(useref())
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser', RAW));

	gulp.src('MultiSimulationAnalyser/img/**', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/img', RAW));

	gulp.src('MultiSimulationAnalyser/images/**', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/images', RAW));

	gulp.src('MultiSimulationAnalyser/icons/**', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/icons', RAW));

	gulp.src('MultiSimulationAnalyser/im_img/**', RAW)
	.pipe(gulp.dest(destFolder+'MultiSimulationAnalyser/im_img', RAW));
}
