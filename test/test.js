
var should = require('chai').should();
var fs = require('fs');
var exec = require('child_process').exec;
var piexif = require('piexifjs');
var jpegjs = require('jpeg-js');
var jo = require('../src/main.js');

describe('jpeg-autorotate', function()
{

    itShouldTransform(__dirname + '/samples/image_2.jpg', 'image_2.jpg');
    itShouldTransform(__dirname + '/samples/image_3.jpg', 'image_3.jpg');
    itShouldTransform(__dirname + '/samples/image_4.jpg', 'image_4.jpg');
    itShouldTransform(__dirname + '/samples/image_5.jpg', 'image_5.jpg');
    itShouldTransform(__dirname + '/samples/image_6.jpg', 'image_6.jpg');
    itShouldTransform(__dirname + '/samples/image_7.jpg', 'image_7.jpg');
    itShouldTransform(__dirname + '/samples/image_8.jpg', 'image_8.jpg');
    itShouldTransform(__dirname + '/samples/image_exif.jpg', 'image_exif.jpg');

    it('Should return an error if the orientation is 1', function(done)
    {
        jo.rotate(__dirname + '/samples/image_1.jpg', {}, function(error, buffer, orientation)
        {
            error.should.have.property('code').equal(jo.errors.correct_orientation);
            done();
        });
    });

    it('Should return an error if the image does not exist', function(done)
    {
        jo.rotate('foo.jpg', {}, function(error, buffer, orientation)
        {
            error.should.have.property('code').equal(jo.errors.read_file);
            done();
        });
    });

    it('Should return an error if the file is not an image', function(done)
    {
        jo.rotate(__dirname + '/samples/textfile.md', {}, function(error, buffer, orientation)
        {
            error.should.have.property('code').equal(jo.errors.read_exif);
            done();
        });
    });

    it('Should return an error if the image has no orientation tag', function(done)
    {
        jo.rotate(__dirname + '/samples/image_no_orientation.jpg', {}, function(error, buffer, orientation)
        {
            error.should.have.property('code').equal(jo.errors.no_orientation);
            done();
        });
    });

    it('Should return an error if the image has an unknown orientation tag', function(done)
    {
        jo.rotate(__dirname + '/samples/image_unknown_orientation.jpg', {}, function(error, buffer, orientation)
        {
            error.should.have.property('code').equal(jo.errors.unknown_orientation);
            done();
        });
    });

    it('Should run on CLI', function(done)
    {
        var cli = __dirname + '/../src/cli.js';
        var ref = __dirname + '/samples/image_2.jpg';
        var tmp = __dirname + '/samples/image_2_cli.jpg';
        var command = 'cp ' + ref + ' ' + tmp + ' && ' + cli + ' ' + tmp + ' && rm ' + tmp;
        exec(command, function(error, stdout, stderr)
        {
            stdout.should.be.a('string').and.contain('Processed (Orientation was 2)');
            done();
        });
    });

    // @todo test jo.errors.read_exif (corrupted EXIF data ?)
    // @todo test jo.errors.rotate_file (corrupted JPEG ?)

});

/**
 * Tries to transform the given path, and checks data integrity (EXIF, dimensions)
 * @param path
 * @param label
 */
function itShouldTransform(path, label)
{
    it('Should rotate image (' + label + ')', function(done)
    {
        this.timeout(10000);
        var orig_buffer = fs.readFileSync(path);
        var orig_exif = piexif.load(orig_buffer.toString('binary'));
        var orig_jpeg = jpegjs.decode(orig_buffer);
        jo.rotate(path, {}, function(error, buffer, orientation)
        {
            if (error)
            {
                throw error;
            }
            var dest_exif = piexif.load(buffer.toString('binary'));
            var dest_jpeg = jpegjs.decode(buffer);
            if (orientation < 5 && (orig_jpeg.width !== dest_jpeg.width || orig_jpeg.height !== dest_jpeg.height))
            {
                throw new Eror('Dimensions do not match');
            }
            if (orientation >= 5 && (orig_jpeg.width !== dest_jpeg.height || orig_jpeg.height !== dest_jpeg.width))
            {
                throw new Eror('Dimensions do not match');
            }
            if (!compareEXIF(orig_exif, dest_exif))
            {
                throw new Error('EXIF do not match');
            }
            done();
        });
    });
}

/**
 * Compares EXIF arrays
 * The properties allowed to differ between the two versions are set to 0
 * @param orig
 * @param dest
 */
function compareEXIF(orig, dest)
{
    orig['thumbnail'] = 0; // The thumbnail
    dest['thumbnail'] = 0;
    orig['0th'][piexif.ImageIFD.Orientation] = 0; // Orientation
    dest['0th'][piexif.ImageIFD.Orientation] = 0;
    orig['0th'][piexif.ImageIFD.ExifTag] = 0; // Pointer to the Exif IFD
    dest['0th'][piexif.ImageIFD.ExifTag] = 0;
    orig['Exif'][piexif.ExifIFD.PixelXDimension] = 0; // Image width
    dest['Exif'][piexif.ExifIFD.PixelXDimension] = 0;
    orig['Exif'][piexif.ExifIFD.PixelYDimension] = 0; // Image height
    dest['Exif'][piexif.ExifIFD.PixelYDimension] = 0;
    orig['1st'][piexif.ImageIFD.JPEGInterchangeFormat] = 0; // Offset to the start byte of the thumbnail
    dest['1st'][piexif.ImageIFD.JPEGInterchangeFormat] = 0;
    orig['1st'][piexif.ImageIFD.JPEGInterchangeFormatLength] = 0; // Number of bytes of the thumbnail
    dest['1st'][piexif.ImageIFD.JPEGInterchangeFormatLength] = 0;

    var orig_json = JSON.stringify(orig);
    var dest_json = JSON.stringify(dest);

    return orig_json === dest_json;
}
