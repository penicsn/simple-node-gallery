'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const sharp = require('sharp');
const exifReader = require('exif-reader');

const IMAGE_EXTENTIONS = ['jpg', 'png', 'gif', 'jpeg', 'bmp'];
const IMAGE_SIZES = [320, 1024];
const VIDEO_EXTENTIONS = ['mp4', 'mkv', 'avi'];
const album = '/album/';

let _galleries = {
    "list": [],
    "created": new Date(),
    "modified": null
};
let refreshGalleryInterval = 5 * 60 * 1000;

function getPathAsArray(dir) {
	if(!dir) {
		return [];
	}

	return dir.substr(global.appPaths.gallery.length + path.sep.length).split(path.sep);
}

function isRootGallery(dir) {
	if(!dir) {
		return false;
	}

	return getPathAsArray(dir).length < 2;
}

function convertUrlToArray(url) {
    if(!url) {
        return url;
    }

    return url.split("/").filter(function(u) { return u; });
}

function getGalleryObject(dir) {
    let gallery = path.parse(dir); // root, dir, base, ext, name
        gallery.url = path.normalize(album + dir.substr(global.appPaths.gallery.length + path.sep.length).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\./g, "-"));
        gallery.subGallery = [];
        gallery.files = [];
        gallery.images = [];
        gallery.videos = [];

    return gallery;
}

function getAlbumUrlArray(galleryUrl) {
    let urlArray = [];
    
    if(galleryUrl.lastIndexOf("/") < album.length) {
        urlArray.push(galleryUrl);
    } else {
        let rootGalleryIndex = galleryUrl.indexOf("/", album.length);
        urlArray.push(galleryUrl.substr(0, rootGalleryIndex));
        let remainingSlashCount = galleryUrl.substr(rootGalleryIndex).match(/\//g).length,
            nextSlashIndex = rootGalleryIndex + 1;

        for(let i = 0; i < remainingSlashCount; i++) {
            let afterNextSlashIndex = galleryUrl.indexOf("/", nextSlashIndex);
            if(afterNextSlashIndex < 0) {
                urlArray.push(galleryUrl);
            } else {
                urlArray.push(galleryUrl.substr(0, afterNextSlashIndex));
                nextSlashIndex = afterNextSlashIndex + 1;
            }
        }
    }

    return urlArray;
}

function addRootGalleryByPath(fullPath) {
    if(_.isEmpty(fullPath)) {
        return;
    }

    let pathsArray = getPathAsArray(fullPath),
        rootGallery = _.find(_galleries.list, (g) => { return g.base === pathsArray[0] })

    if(!rootGallery) {
        _galleries.list.push(getGalleryObject(fullPath));
        _galleries.modified = new Date();
    }
}

function getGalleryBy(byArray, key) {
    if(_.isEmpty(byArray) || _.isEmpty(key)) {
        return;
    }

    let rootGallery = _.find(_galleries.list, (g) => { return g[key] === byArray[0] }),
        subGallery,
        result;
    
    if(!rootGallery) {
        return;
    }

    if(byArray.length === 1 && rootGallery) {
        return rootGallery;
    }

    for(let i = 1, l = byArray.length; i < l; i++) {
        if(rootGallery) {
            subGallery = _.find(rootGallery.subGallery, (sg) => { return sg[key] === byArray[i]; });
        }

        if(!subGallery) {
            if(_.last(rootGallery.subGallery)) {
                rootGallery = _.last(rootGallery.subGallery);
            }
        } else {
            result = rootGallery = subGallery;
        }
    }

    return result;
}

function addSubGalleryByPath(fullPath) {
    if(_.isEmpty(fullPath)) {
        return;
    }

    let pathsArray = getPathAsArray(fullPath),
        gallery = getGalleryBy(pathsArray, "base"),
        rootGallery = _.find(_galleries.list, (g) => { return g.base === pathsArray[0] }),
        subGallery;
    
    if(!rootGallery) {
        return;
    }
    
    for(let i = 1, l = pathsArray.length; i < l; i++) {
        if(rootGallery) {
            subGallery = _.find(rootGallery.subGallery, (sg) => { return sg.base === pathsArray[i]; });
        }

        if(!subGallery) {
            rootGallery.subGallery.push(getGalleryObject(fullPath));
            rootGallery = rootGallery.subGallery[rootGallery.subGallery.length-1];
        } else {
            rootGallery = subGallery;
        }
    }
}

function addGalleryByPath(fullPath) {
    if(!fullPath) {
        return;
    }

    if(isRootGallery(fullPath)) {
        addRootGalleryByPath(fullPath);
    } else {
        addSubGalleryByPath(fullPath);
    }
}

function resizeImages(sizes, imagePath) {
    const resize = size => sharp(imagePath)
        .resize(size, size)
        .max()
        .toFile(imagePath.substr(0, imagePath.lastIndexOf(".")) + "-"+size+"x"+size + imagePath.substr(imagePath.lastIndexOf(".")));

    Promise
        .all(sizes.map(resize))
        .then(() => {
            console.log('Resize completed: ', imagePath);
        });
    /*
    return image
    .resize(Math.round(metadata.width / 2))
    .toFile();

    .then(function(data) {
        // data contains a WebP image half the width and height of the original JPEG
    });
    */
}

function addImageToGallery(gallery, file) {
    if(!gallery || !file) {
        return;
    }

    function getFileName(size) {
        if(!size) {
            return path.join(file.dir, file.name+file.ext);
        }
        
        return path.join(file.dir, file.name+"-"+size+"x"+size+file.ext);
    }

    let sizes = [];

    IMAGE_SIZES.forEach((s) => {
        let fileName = getFileName(s);
        if(!fs.existsSync(fileName)) {
            sizes.push(s);
        }
        file["url"+s] = "/"+fileName.substr(global.appPaths.gallery.length + path.sep.length);
    });

    resizeImages(sizes, getFileName());

    gallery.push(file);
}

function addFileByPath(fullPath) {
    if(!fullPath || IMAGE_SIZES.some((size)=>{ return fullPath.indexOf(size) > -1; })) {
        return;
    }

    let fileObject = path.parse(fullPath),
        fileType = "files",
        pathsArray = getPathAsArray(fullPath),
        gallery = getGalleryBy(_.first(pathsArray, pathsArray.length - 1), "base");
    
    fileObject.url = "/"+fullPath.substr(global.appPaths.gallery.length + path.sep.length);

    if(IMAGE_EXTENTIONS.indexOf(fileObject.ext.replace(".","").toLowerCase()) >= 0) {
        fileType = "images";
        const image = sharp(fullPath);
        image.metadata().then(function(metadata) {
            if(metadata && metadata.exif) {
                const exif = exifReader(metadata.exif);
                fileObject.metadata = exif;
            }

            addImageToGallery(gallery.images, fileObject);
        });
    } else if(VIDEO_EXTENTIONS.indexOf(fileObject.ext.replace(".","").toLowerCase()) >= 0) {
        fileType = "videos";
    }

    if(gallery && fileType !== "images") {
        gallery[fileType].push(fileObject);
    }
}

function readGalleryDirectory(dir, callback) {
    var results = [];

    fs.readdir(dir, function(readdirError, files) {
        if(readdirError) {
            console.log("Readdir error: ", readdirError);
            return callback(readdirError);
        }

        let pending = files.length;
      
        if(!pending) {
            return callback(null, _galleries);
        }

        files.forEach(function(file) {
            var fullPath = path.resolve(dir, file);

            fs.stat(fullPath, function(statError, stat) {
                if(statError) {
                    console.log("Stat error: ", statError);
                    return callback(statError);
                }

                if(stat && stat.isDirectory()) {
                    addGalleryByPath(fullPath);

                    readGalleryDirectory(fullPath, function(callbackError, result) {
                        //results = results.concat(result);
                        if(!--pending) {
                            console.log("isDir callback: ", fullPath);
                            callback(null, _galleries);
                        }
                    });
                } else if(stat && stat.isFile()) {
                    addFileByPath(fullPath);
                    
                    if(!--pending) {
                        console.log("isFile callback: ", fullPath);
                        callback(null, _galleries);
                    }
                }
            });
        });
    });
};

function getRootGalleries(onSuccess, onError) {
    let currentData = new Date();

    if(_.isEmpty(_galleries.list)) {
        readGalleryDirectory(global.appPaths.gallery, onSuccess);
        return;
    }

    onSuccess && onSuccess(null, _galleries);
}

function getGalleryByUrl(galleryUrl, onSuccess, onError) {
    if(_.isEmpty(galleryUrl)) {
        return;
    }

    getRootGalleries((error, galleries) => {
        let gallery = getGalleryBy(getAlbumUrlArray(galleryUrl), "url");
        
        if(gallery) {
            onSuccess && onSuccess(gallery);
        }
    });
}

module.exports = {
    getAll: getRootGalleries,
    getByUrl: getGalleryByUrl
};