var commit,
    fileElementPrototype;

// Create a new Commit object
// obj: PBGitCommit object
var Commit = function(obj) {
	this.object = obj;

	this.refs = obj.refs();
	this.author_name = obj.author();
	this.author_email = obj.authorEmail();
	this.author_date = obj.authorDate();
	this.committer_name = obj.committer();
	this.committer_email = obj.committerEmail();
	this.committer_date = obj.committerDate();
	this.sha = obj.SHA();
	this.parents = obj.parents();
	this.subject = obj.subject();
	this.message = obj.message();
	this.notificationID = null;

	this.reloadRefs = function() {
		this.refs = this.object.refs();
	}

};

var extractPrototypes = function() {
	// Grab an element from the DOM, save it in a global variable (with its
	// id removed) so it can be copied later, and remove it from the DOM.
	fileElementPrototype = $('file_prototype');
	fileElementPrototype.removeAttribute('id');
	fileElementPrototype.parentNode.removeChild(fileElementPrototype);
}

var setGravatar = function(email, image) {
	image.src=(createGravatarUrl(email, image));
};

var createGravatarUrl = function(email, image) {
	if(Controller && !Controller.isFeatureEnabled_("gravatar")) {
		return "";
	}

	var gravatarBaseUrl = "https://www.gravatar.com/avatar/";
	var gravatarParameter = "?d=wavatar&s=60";

	var gravatarID = (email && hex_md5(email.toLowerCase().replace(/ /g, ""))) ||  "";

	return gravatarBaseUrl + gravatarID + gravatarParameter;
};

var selectCommit = function(a) {
	Controller.selectCommit_(a);
};

// Relead only refs
var reload = function() {
	$("notification").classList.add("hidden");
	commit.reloadRefs();
	showRefs();
}

var showRefs = function() {
	var refs = $("refs");
	if (commit.refs) {
		refs.classList.remove("hidden");
		refs.textContent = "";
		for (var i = 0; i < commit.refs.length; i++) {
			var ref = commit.refs[i];
			var span = document.createElement("span");
			span.classList.add("refs", ref.type());
			if (commit.currentRef == ref.ref) {
				span.classList.add("currentBranch");
			}
			span.textContent = ref.shortName();
			refs.appendChild(span);
		}
	} else
		refs.classList.add("hidden");
}

var loadCommit = function(commitObject, currentRef) {
	// These are only the things we can do instantly.
	// Other information will be loaded later by loadCommitSummary
	// and loadCommitFullDiff, which will be called from the
	// controller once the commit details are in.

	if (commit && commit.notificationID)
		clearTimeout(commit.notificationID);

	commit = new Commit(commitObject);
	commit.currentRef = currentRef;

	$("commitID").textContent = commit.sha;
	$("subjectID").textContent = commit.subject;
	$("diff").textContent = "";
	$("date").textContent = "";
	$("files").classList.add("hidden");

	var setFormattedEmailContent = function(node, name, email) {
		if (email) {
			node.textContent = name + " <";
			var a = document.createElement("a");
			a.href = "mailto:" + email;
			a.textContent = email;
			node.appendChild(a);
			node.appendChild(document.createTextNode(">"));
		} else {
			node.textContent = name;
		}
	}

	setFormattedEmailContent($("authorID"), commit.author_name, commit.author_email);
	$("date").textContent = commit.author_date;
	setGravatar(commit.author_email, $("author_gravatar"));

	if (commit.committer_name != commit.author_name || commit.committer_email != commit.author_email) {
		$("committerID").parentNode.parentNode.classList.remove("hidden");
		setFormattedEmailContent($("committerID"), commit.committer_name, commit.committer_email);
		$("committerDate").textContent = commit.committer_date;
		setGravatar(commit.committer_email, $("committer_gravatar"));

		$("commitDate").parentNode.classList.add("hidden");
	} else if (commit.committer_date != commit.author_date) {
		$("commitDate").parentNode.classList.remove("hidden");

		$("commitDate").textContent = commit.committer_date;

		$("committerID").parentNode.parentNode.classList.add("hidden");
	} else {
		$("committerID").parentNode.parentNode.classList.add("hidden");
		$("commitDate").parentNode.classList.add("hidden");
	}

	var textToHTML = function (txt) {
		return (" " + txt.escapeHTML() + " ")
			.replace(/(https?:\/\/([^\s\.\)\]\<]+|\.[^\s])+)/ig, function(m, url) {
				var a = document.createElement("a");
				a.href = url;
				a.textContent = url;
				return a.outerHTML;
			})
			.replace(/\n/g,"<br>")
			.trim();
	}

	$("message").innerHTML = textToHTML(commit.message);

	jQuery("#commit").show();
	jQuery("#no-commit-message").hide();
	var filelist = $("filelist");
	while (filelist.hasChildNodes())
		filelist.removeChild(filelist.lastChild);
	showRefs();

	// Scroll to top
	scroll(0, 0);

	var parentsNode = $("parents");
	parentsNode.innerHTML = '';
	if (commit.parents) {
		for (var i = 0; i < commit.parents.length; i++) {
			var container = document.createElement("span");
			container.innerHTML = '<a class="SHA commit-link" href="">' + commit.parents[i].SHA() + "</a>";
			parentsNode.appendChild(container);
		}
		bindCommitSelectionLinks(parentsNode);
	}

	commit.notificationID = setTimeout(function() {
		if (!commit.fullyLoaded)
			notify("Loading commit…", 0);
		commit.notificationID = null;
	}, 500);

}

var showMultipleSelectionMessage = function(messageParts) {
	jQuery("#commit").hide();
	jParagraphs = jQuery.map(messageParts, function(message) {
		return jQuery( '<p/>', { text:message } )
	});
	jQuery("#no-commit-message").empty().append(jParagraphs).show();
};

var commonPrefix = function(a, b) {
    if (a === b) return a;
    var i = 0;
    while (a.charAt(i) == b.charAt(i))++i;
    return a.substring(0, i);
};
var commonSuffix = function(a, b) {
    if (a === b) return "";
    var i = a.length - 1,
        k = b.length - 1;
    while (a.charAt(i) == b.charAt(k)) {
        --i;
        --k;
    }
    return a.substring(i + 1, a.length);
};
var renameDiff = function(a, b) {
    var p = commonPrefix(a, b),
        s = commonSuffix(a, b),
        o = a.substring(p.length, a.length - s.length),
        n = b.substring(p.length, b.length - s.length);
    return [p, o, n, s];
};
var formatRenameDiff = function(d) {
    var p = d[0],
        o = d[1],
        n = d[2],
        s = d[3];
    if (o === "" && n === "" && s === "") {
        return p;
    }
    return [p, "{ ", o, " → ", n, " }", s].join("");
};

var showDiff = function() {

	// Callback for the diff highlighter. Used to generate a filelist
	var binaryDiffClass = "display-binary-as-image"
	var binaryDiffHTML = function(filename) {
		if (filename.match(/\.(png|jpg|icns|psd)$/i)) {
			var a = document.createElement("a");
			a.href = "#";
			a.dataset.filename = filename;
			a.className = binaryDiffClass;
			a.textContent = "Display image";
			return a.outerHTML;
		} else {
			return "Binary file differs";
		}
	};
	var binaryDiffClick = function(e) {
		e.preventDefault();
		return showImage(this, this.dataset.filename);
	};

	highlightDiff(commit.diff, $("diff"), {
		"binaryFileHTML" : binaryDiffHTML,
		"binaryFileClass" : binaryDiffClass,
		"binaryFileOnClick" : binaryDiffClick,
	});
}

var showImage = function(element, filename)
{
	var img = document.createElement("img");
	img.src = "GitX://" + commit.sha + "/" + filename;
	element.outerHTML = img.outerHTML;
	return false;
}

var enableFeature = function(feature, element)
{
	if(!Controller || Controller.isFeatureEnabled_(feature)) {
		element.classList.remove("hidden");
	} else {
		element.classList.add("hidden");
	}
}

var enableFeatures = function()
{
	enableFeature("gravatar", $("author_gravatar").parentNode)
	enableFeature("gravatar", $("committer_gravatar").parentNode)
}

var loadCommitDiff = function(jsonData)
{
	var diffData = JSON.parse(jsonData)
	commit.filesInfo = diffData.filesInfo;
	commit.diff = diffData.fullDiff;

	if (commit.notificationID) {
		clearTimeout(commit.notificationID)
	} else {
		$("notification").classList.add("hidden");
	}

	if (commit.filesInfo.length > 0) {
		// Create the file list
		for (var i=0; i < commit.filesInfo.length; i+=1) {
			var fileInfo = commit.filesInfo[i];
			var fileElem = fileElementPrototype.cloneNode(true); // this is a <li>
			fileElem.targetFileId = "file_index_"+i;

			var displayName, representedFile;
			if (fileInfo.changeType === "renamed") {
				displayName = formatRenameDiff(renameDiff(fileInfo.oldFilename, fileInfo.newFilename));
				representedFile = fileInfo.newFilename;
			}
			else {
				displayName = fileInfo.filename;
				representedFile = fileInfo.filename;
			}
			fileElem.title = fileInfo.changeType + ": " + displayName; // set tooltip
			fileElem.setAttribute("representedFile", representedFile);

			if (i % 2)
				fileElem.className += "even";
			else
				fileElem.className += "odd";
			fileElem.onclick = function () {
				// Show the full diff in case it's not already visisble.
				showDiff();
				// Scroll to that file.
				$(this.targetFileId).scrollIntoView(true);
			}

			// Start with a modified icon, and update it later when the
			// `diff --summary` info comes back.
			var imgElement = fileElem.getElementsByClassName("changetype-icon")[0];
			imgElement.src = "../../images/"+fileInfo.changeType+".svg";

			var filenameElement = fileElem.getElementsByClassName("filename")[0];
			filenameElement.innerText = displayName;

			var diffstatElem = fileElem.getElementsByClassName("diffstat-info")[0];
			var binaryElem = fileElem.getElementsByClassName("binary")[0]
			if (fileInfo.binary) {
				// remove the diffstat-info element
				diffstatElem.parentNode.removeChild(diffstatElem);
				binaryElem.innerText =
				    fileInfo.oldFileSize + " \u2192 " + fileInfo.newFileSize + " bytes";
			}
			else {
				// remove the binary element
				binaryElem.parentNode.removeChild(binaryElem);

				// Show the num of lines added/removed
				var addedWidth = 2 * fileInfo.numLinesAdded;
				var removedWidth = 2 * fileInfo.numLinesRemoved;
				// Scale them down proportionally if they're too wide.
				var maxWidth = 350;
				var minWidth = 5;
				if (addedWidth+removedWidth > maxWidth) {
					var scaleBy = maxWidth/(addedWidth+removedWidth);
					addedWidth *= scaleBy;
					removedWidth *= scaleBy;
				}
				if (addedWidth > 0 && addedWidth < minWidth) addedWidth = minWidth;
				if (removedWidth > 0 && removedWidth < minWidth) removedWidth = minWidth;

				// show lines changed info
				var numLinesAdded = fileInfo.numLinesAdded;
				var numLinesRemoved = fileInfo.numLinesRemoved;
				var numLinesChanged = numLinesAdded + numLinesRemoved;
				// summarize large numbers
				if (numLinesChanged > 999) numLinesChanged = "~" + Math.round(numLinesChanged / 1000) + "k";

				// fill in numbers
				var diffstatSummary = diffstatElem.getElementsByClassName("diffstat-numbers")[1];
				diffstatSummary.innerText = numLinesChanged;
				diffstatSummary.addEventListener("mouseover", function() {
					expandDiffstatDetails(this);
				});
				diffstatSummary.addEventListener("mouseout", function() {
					collapseDiffstatDetails(this);
				});

				var diffstatDetails = diffstatElem.getElementsByClassName("diffstat-numbers")[0];
				diffstatDetails.getElementsByClassName("added")[0].innerText = "+"+numLinesAdded;
				diffstatDetails.getElementsByClassName("removed")[0].innerText = "-"+numLinesRemoved;

				// Size the bars
				var addedBar = diffstatElem.getElementsByClassName("changes-bar")[0];
				if (addedWidth >= minWidth)
					addedBar.style.width = addedWidth;
				else
					addedBar.style.visibility = "hidden";

				var removedBar = diffstatElem.getElementsByClassName("changes-bar")[1];
				if (removedWidth >= minWidth)
					removedBar.style.width = removedWidth;
				else
					removedBar.style.visibility = "hidden";
			}
			$("filelist").appendChild(fileElem);
		}
		$("files").classList.remove("hidden");
	}

	if (commit.diff.length < 200000)
		showDiff();
	else {
		var diffEl = $("diff");
		diffEl.innerHTML = "<a class='showdiff' href=''>This is a large commit.<br>Click here or press 'v' to view.</a>";
		diffEl.getElementsByClassName("showdiff")[0].addEventListener("click", function(e) {
			e.preventDefault();
			showDiff();
		});
	}
	hideNotification();
	enableFeatures();
}

function expandDiffstatDetails(obj) {
	var children = obj.parentNode.childNodes;
	for (i in children) {
		var c = children[i];
		if (c.classList.contains("details")) {
			c.classList.remove("hidden");
		}
	}
	return true;
}

function collapseDiffstatDetails(obj) {
	var children = obj.parentNode.childNodes;
	for (i in children) {
		var c = children[i];
		if (c.classList.contains("details")) {
			c.classList.remove("hidden");
		}
	}
	return true;
}

document.addEventListener("DOMContentLoaded", function() {
	extractPrototypes();
});
