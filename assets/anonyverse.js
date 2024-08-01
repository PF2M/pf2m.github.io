// this is an edited copy of cedar's js because the original miniverse js was lost and all the hours of edits i put into it disappeared
// all credits go to SethAtCedar https://github.com/EnergeticBark/Cedar-PHP

var atBottom = false;
var offset = 20;
var loading = 0;
var avatar;

function popup(title, text) {
	$('body').append('<div class="dialog active-dialog modal-window-open mask">\
		<div class="dialog-inner">\
			<div class="window">\
				<h1 class="window-title">' + title + '</h1>\
				<div class="window-body">\
					<p class="window-body-content">' + text + '</p>\
					<div class="form-buttons">\
						<button class="ok-button black-button" type="button" data-event-type="ok">OK</button>\
					</div>\
				</div>\
			</div>\
		</div></div>');
	bindEvents();
}

function confirm(title, text, success) {
	$('body').append('<div class="dialog active-dialog modal-window-open mask">\
		<div class="dialog-inner">\
			<div class="window">\
				<h1 class="window-title">' + title + '</h1>\
				<div class="window-body">\
					<p class="window-body-content">' + text + '</p>\
					<div class="form-buttons">\
					    <button class="cancel-button gray-button" type="button" data-event-type="cancel" onclick="$(\'.dialog\').remove()">Cancel</button>\
						<button class="ok-button black-button" type="button" data-event-type="ok" onclick="' + success + '">OK</button>\
					</div>\
				</div>\
			</div>\
		</div></div>');
	bindEvents();
}

function getNotifs() {
	$.post('?a=news', {token: $('body').data('token')}, function(data) {
		if (data.unread > 0) {
			favicon.badge(data.unread);
			$('.badge').removeClass('none').text(data.unread);
		} else {
			favicon.reset();
			$('.badge').addClass('none').text(data.unread);
		}
	});
}

setInterval(function(){ 
    	getNotifs();
    }, 30000);

var favicon = new Favico({
    animation:'none'
});

function bindEvents() {
	
	$("[data-href]").off().on('click', (function(e){
		var href = $(this).attr('data-href');
		
		//if you click on a post it takes you to 'data-href' an attribute defined in list.php for each post
		$.pjax({url: href, container: '#main-body'});
    }));

	$('#login-form').off().on('submit', function(e){
		e.preventDefault();
		$('#login-button').attr('disabled', '');
		var formData = new FormData(this);
		$.ajax({url: $(this).attr('action'), type: 'POST', data: formData, success:function(data){
		    if(data.error === 0) location.reload();
		    else {
		        popup('Error', data.message);
		        $('#login-button').removeAttr('disabled');
		    }
		}, contentType: false, processData: false})
	});

    $('.my-menu-dark-toggle').off().on('click', function(e) {
    	e.preventDefault();

    	var v = document.cookie.match('(^|;) ?dark-mode=([^;]*)(;|$)');
    	isDark = v ? v[2] : null;

    	if (isDark == null) {
    		var d = new Date();
    		d.setTime(d.getTime() + (365*24*60*60*1000));
    		var expires = "expires="+ d.toUTCString();
    		document.cookie = "dark-mode=1;" + expires + ";path=/";

    		$('link[href="/assets/css/style.css"]').after('<link rel="stylesheet" type="text/css" href="/assets/css/dark.css">');
    		$('.empty-icon').children().attr('src', '/assets/img/dark-empty.png');
    	} else {
    		document.cookie = 'dark-mode=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/';

    		$('link[href="/assets/css/dark.css"]').remove();
    		$('.empty-icon').children().attr('src', '/assets/img/empty.png');
    	}
    });


    // prevents opening a post when clicking a link
    $('.link').off().on('click', function(e) {
    	e.stopImmediatePropagation();
    })





	
    $('.empathy-button').off().on('click', function(event) {
    	event.stopPropagation();

    	var postId = $(this).attr('id');

    	//changes the yeah button to disabled so no one yeahs twice while its posting the first yeah just like on miiverse holy shish
    	$('#'+postId).attr('disabled', '');

    	$.post($(this).attr('data-action'), {token: $('body').data('token')}, function(data) {
    		if(data.error == 0) {

    			$('#'+postId).addClass('empathy-added');
    			$('#'+postId).find('.empathy-button-text').text('Unyeah');
    			$('#'+postId).closest('div').find('.empathy-count').text(Number($('#'+postId).closest('div').find('.empathy-count').text()) + 1);



				if (postId.substr(0, 1) == 'p') {
					$('#empathy-content').removeClass('none');
					$('.visitor').removeClass("none");
				} else {
					$('.reply-permalink-post #empathy-content').removeClass('none');
					$('.reply-permalink-post .visitor').removeClass("none");
				}
				$('#'+postId).attr('data-action', $('#'+postId).attr('data-action').replace('yeah', 'unyeah'));

				//rebind events here
				bindEvents();
			} else {
				popup('Error', 'Yeah failed.');
			}

			$('#'+postId).removeAttr("disabled");
		})
    });

    $('.empathy-added').off().on('click', function(event){
    	event.stopPropagation();
    	var postId = $(this).attr('id');
		
		//same thing here just for unyeahs lol
		$('#'+postId).attr('disabled', '');

		$.post($(this).attr('data-action'), {token: $('body').data('token')}, function(data){
			if(data.error == 0){
				$('#'+postId).removeClass('empathy-added');
				$('#'+postId).find('.empathy-button-text').text('Yeah!');
				$('#'+postId).closest('div').find('.empathy-count').text(Number($('#'+postId).closest('div').find('.empathy-count').text()) - 1);

				if (postId.substr(0, 1) == 'p') {
					$('.visitor').addClass('none');
					if ($('#'+postId).find('.empathy-count').text() < 1){
						$('#empathy-content').addClass('none');
					}
				} else {
					$('.reply-permalink-post .visitor').addClass('none');
					if ($('.reply-permalink-post .empathy-count').text() < 1){
						$('.reply-permalink-post #empathy-content').addClass('none');
					}
				}
				$('#'+postId).attr('data-action', $('#'+postId).attr('data-action').replace('unyeah', 'yeah'));

				//rebind events here
				bindEvents();
			} else {
				popup('Error', 'Unyeah failed.');
			}

			$('#'+postId).removeAttr("disabled");
		})
	});

	$(".js-open-global-my-menu").off().click(function() {
		$('#global-my-menu').not($("#global-my-menu").toggleClass('none')).addClass('none');
	});
	
	$('.textarea').click(function() {
	    $('.folded').removeClass('folded');
	});

	$('.textarea').keyup(function() {
		var text_length = $('.textarea:visible').val().length;
		var text_remaining = 2000 - text_length;
		$('.remaining-today-post-count').text(text_remaining);
	});
	
	$('.file-button').change(function(e) {
	    if($(this)[0].files.length > 0) {
	        $('.post-button').removeAttr('disabled');
	        $('.post-button').removeClass('disabled');
	    } else if($('.textarea').text().length === 0) {
	        $('.post-button').attr('disabled', '');
	        $('.post-button').addClass('disabled');
	    }
	});

	$(document).off().on('click',function (e) {
		footerUl = $('.open-global-my-menu');
		if ((!footerUl.is(e.target) && footerUl.has(e.target).length === 0) && (!$('#global-my-menu').is(e.target) && $('#global-my-menu').has(e.target).length === 0 && $('.dialog').has(e.target).length === 0 && $('.ok-button').has(e.target).length === 0)){
			$('#global-my-menu').addClass('none');
		}
	});
	
	$('.hidden-content-button').off().on('click', function(e) {
	    e.stopImmediatePropagation();
	    $(this).parents('.post').attr('data-href', $(this).parents('.post').attr('data-href-hidden'));
	    $(this).parents('.post').removeAttr('data-href-hidden');
	    $(this).parents('.post').removeClass('hidden');
	    $(this).parent().remove();
	    bindEvents();
	});

	$('.js-open-truncated-text-button').off().on('click', function(){
		$(this).addClass('none');
		$('.js-truncated-text').addClass('none');
		$('.js-full-text').removeClass('none');
		bindEvents();
	})

	$('.favorite-button').off().on('click', function(){
		var titleId = $(this).attr('data-title-id');
		if ($('.favorite-button').hasClass('checked')){

			$.post($(this).data('action-unfavorite'), {token: $('body').data('token')}, function(data) {
				if(data.error == 0){
					$('.favorite-button').removeClass('checked');
				}
			})
		} else {
			$.post($(this).data('action-favorite'), {token: $('body').data('token')}, function(data) {
				if(data.error == 0){
					$('.favorite-button').addClass('checked');
				}
			})
		}
	});

	$('input[name="face-type"]').click(function(){
		if ($('input[name="face-type"][value="2"]').is(':checked')) {
			$('.nnid-face').removeClass('none');
			$('.custom-face').addClass('none');
		} else {
			$('.custom-face').removeClass('none');
			$('.nnid-face').addClass('none');
		}
	});

	$('.feeling-button').click(function(){
		$('.feeling-button').removeClass('checked');
		$(this).addClass('checked');
	})

	$('.follow-button').off().on('click', function(){
		event.stopPropagation();
		var userAction = $(this).data('action');
		$.post(userAction, {token: $('body').data('token')}, function(data) {
			if(data.error == 0){
				$('.follow-button[data-action="' + userAction + '"]').addClass('none');
				$('.unfollow-button[data-action="' + userAction.replace('a=follow', 'a=unfollow') + '"]').removeClass('none');
				bindEvents();
			}
		})
	});

	$('.unfollow-button').off().on('click', function(){
		event.stopPropagation();
		var userAction = $(this).data('action');
		$.post(userAction, {token: $('body').data('token')}, function(data) {
			if(data.error == 0){
				$('.unfollow-button[data-action="' + userAction + '"]').addClass('none');
				$('.follow-button[data-action="' + userAction.replace('a=unfollow', 'a=follow') + '"]').removeClass('none');
				bindEvents();
			}
		})
	});
	
	$('#profile-post').off().on('click', function(){
		$.post($(this).data('action'), {token: $('body').data('token')}, function(){$('#profile-post').remove()});
	});
	
	$('.profile-post-button').off().on('click', function(){
	    if($(this).hasClass('done')) confirm('Favorite Post', 'Unset your favorite post?', "$.post('" + $(this).data('action') + "', {token: $('body').data('token')}, function(){location.reload()});");
	    else confirm('Favorite Post', 'Set this as your favorite post?', "$.post('" + $(this).data('action') + "', {token: $('body').data('token')}, function(){location.reload()});");
	});

	$('.edit-post-button').off().on('click', function(){
		$('#the-post').toggleClass('none');
		$('#post-edit').toggleClass('none');
		bindEvents();
	});

	$('.rm-post-button').off().on('click', function(){
		confirm('Delete', 'Are you sure you want to delete this?', "$.post('" + $(this).data('action') + "', {token: $('body').data('token')}, function(){location.reload()});");
	});

	$('.olv-modal-close-button').off().on('click', function(){
		$('.mask').addClass('none');
	});

	$('#edit-form').off().on('submit', function(e){
		e.preventDefault();
		$('.post-button').addClass('disabled').attr('disabled', '');
		var formData = new FormData(this);
		$.ajax({url: $(this).attr('action'), type: 'POST', data: formData, success:function(){
			location.reload();
		}, contentType: false, processData: false});
		bindEvents();
	});

	$('#post-form').find('textarea[name="body"]').on('input', function(){
		if ($(this).val().trim() == "" && $('.file-button')[0].files.length === 0){
			$('#post-form').find('.post-button').addClass('disabled').attr('disabled', '');
		} else {
			$('#post-form').find('.post-button').removeClass('disabled').removeAttr('disabled');
		}
	});
	
	$('#edit-form').find('textarea[name="body"]').on('input', function(){
		if ($(this).val().trim() == "" && $('#the-post .screenshot-container').length === 0){
			$('#edit-form').find('.post-button').addClass('disabled').attr('disabled', '');
		} else {
			$('#edit-form').find('.post-button').removeClass('disabled').removeAttr('disabled');
		}
	});

    $('input[name="sensitive"]').off().click(function() {
        $('.spoiler-button').toggleClass('checked');
    });

	$('#post-form').off().on('submit', function(e){

		e.preventDefault();
		$(this).find('.post-button').addClass('disabled').attr('disabled', '');
		var formData = new FormData(this);
		var code;

		$.ajax({url: $(this).attr('action'), type: 'POST', data: formData,

		statusCode: {
			201: function() {
				var code = 201;
			}
		},

		success:function(data) {
            var post = $($.parseHTML(data.post)).filter("*");
			if ($('#post-form').attr('action').substr(3, 5) == 'reply') {
			    post.hide().fadeIn(400).appendTo('.reply-list');
			} else {
			    post.hide().fadeIn(400).prependTo('.post-list');
			}
			$(window).scrollTop(post.offset().top + post.outerHeight() / 2 - $(window).height() / 2);

			if (code !== 201) {
				$('.no-reply-content').remove();
				$('.no-content').remove();
				$('.feeling-button').removeClass('checked');
				$('.feeling-button-normal').addClass('checked');
				$('.spoiler-button').removeClass('checked');
				$('#post-form').each(function(){this.reset();});
				$('#post-form').find('.remaining-today-post-count').text('2000');
			}
			bindEvents();
		}, contentType: false, processData: false});

	});
	
	$('.oldest-replies-button').on('click', function() {
	    $(this).html('<div class="post-list-loading"><img src="https://res.cloudinary.com/anonyverse/image/upload/v1537911452/loading-image-green.gif" alt=""></div>');
	    $.get($(this).data('fragment-url'), function(data) {
	        $('#reply-content').html($(data).find('#reply-content').html());
	    })
	});
	
	$('input[name="mii"][value="0"]').off().on('click', function() {
	    $('.nnid-icon.avatar').removeClass('none');
	    $('.nnid-icon.mii').addClass('none');
	});
	
	$('input[name="mii"][value="1"]').off().on('click', function() {
	    $('.nnid-icon.avatar').addClass('none');
	    $('.nnid-icon.mii').removeClass('none');
	});
	
	$('input[name="avatar"]').off().on('change', function() {
	    if($('.preview-image').attr('src').startsWith('https')) avatar = $('.preview-image').attr('src');
	    var reader  = new FileReader();
	    reader.addEventListener("load", function () {
            $('.preview-image').attr('src', reader.result);
        }, false);
	    if($(this)[0].files.length > 0) reader.readAsDataURL($(this)[0].files[0]);
	    else $('.preview-image').attr('src', avatar);
	});

	$('.setting-form').off().on('submit', function(e){
		e.preventDefault();
		$('.apply-button').addClass('disabled').prop('disabled', '');
		var formData = new FormData(this);
		$.ajax({url: $(this).attr('action'), type: 'POST', data: formData, success:function(data){
		    if(data.error == 0) {
		        if(typeof data.url !== "undefined") location.href = data.url;
		        else popup('Success', 'Changes saved.');
		    } else popup('Error', data.message);

			$('.apply-button').removeClass('disabled').removeAttr('disabled', '');
		}, contentType: false, processData: false})
	});

	$('.ok-button').off().on('click', function(){
		$('.active-dialog').remove();
	});

	$('.community-top-sidebar .search').on('submit', function(e){
		if ($(this).find('input[type="text"]').val().length < 2){
			e.preventDefault();
		}
	});

	$('.headline .search').on('submit', function(e){
		if ($(this).find('input[type="text"]').val().length < 1){
			e.preventDefault();
		}
	});

	//checks if loadOnScroll is defined. So this code will only run on pages the need it
	if ($('[data-next-page-url]').length > 0 && $('[data-next-page-url]').attr('data-next-page-url').length > 0) {

		$(window).scroll(function() {
			//checks if you're at the bottom of the page and if you are it loads more posts
			if ($(window).scrollTop() + window.innerHeight >= $('[data-next-page-url]').height()) {
				if (loading == 0 && atBottom == false) {
					$("[data-next-page-url]").append('<div class="post-list-loading"><img src="https://res.cloudinary.com/anonyverse/image/upload/v1537911452/loading-image-green.gif" alt=""></div>');
					loading = 1;
					$.get($('[data-next-page-url]').attr('data-next-page-url'), function(data) {
					    data = $(data).find('[data-next-page-url]').html().trim();
						if(data == ''){
							atBottom = true;
							bindEvents();
						}
						$("[data-next-page-url]").append(data);
						offset += 20;
						$('[data-next-page-url]').attr('data-next-page-url', $('[data-next-page-url]').attr('data-next-page-url').replace(/(o=)[0-9]+/,"o=" + offset));
						loading = 0;
						$(".post-list-loading").remove();
						bindEvents();
					})
				}
			}
		});
	}
	
	function updateTime() {
    	var timestamps = $('[time]');
    	for(var i = 0; i < timestamps.length; i++) {
            var timestamp = timestamps.eq(i);
            var since = new Date().getTime() - timestamp.attr('time') - 3000;
            var time = new Date(since);
            if(time < 1000) {
                timestamp.text('Less than a second ago');
            } else if(time < 2000) {
                timestamp.text('1 second ago');
            } else if(time < 60000) {
                timestamp.text(Math.floor(since / 1000) + ' seconds ago');
            } else if(time < 120000) {
                timestamp.text('1 minute ago');
            } else if(time < 3600000) {
                timestamp.text(Math.floor(since / 1000 / 60) + ' minutes ago');
            } else if(time < 7200000) {
                timestamp.text('1 hour ago');
            } else if(time < 86400000) {
                timestamp.text(Math.floor(since / 1000 / 60 / 60) + ' hours ago');
            } else if(time < 172800000) {
                timestamp.text('1 day ago');
            } else if(time < 345600000) {
                timestamp.text(Math.floor(since / 1000 / 60 / 60 / 24) + ' days ago');
            } else {
                var dateTime = new Date(parseInt(timestamp.attr('time')));
                var hours = dateTime.getHours() % 12;
                if(hours == 0) {
                    hours = 12;
                }
                timestamp.text((dateTime.getMonth() + 1).toString().padStart(2, "0") + "/" + dateTime.getDate().toString().padStart(2, "0") + "/" + dateTime.getFullYear() + " " + hours + ":" + dateTime.getMinutes().toString().padStart(2, "0") + " " + (dateTime.getHours() >= 12 ? "PM" : "AM"));
                timestamp.removeClass('update');
            }
        }
    }
    updateTime();
    setTimeout(setInterval(updateTime, 1000), 1000 - (new Date().getTime() % 1000));
    
    $('#global-menu .selected').removeClass('selected');
    if($('meta[name="selected"]').length > 0) $('#global-menu-' + $('meta[name="selected"]').attr('content')).addClass('selected');

	$(document).on('pjax:end', function() {
	    $('#global-my-menu').addClass('none');
		getNotifs();
		bindEvents();
	});

	$(document).pjax('a', '#main-body', replace = true);
}

$(document).ready(function() {
	bindEvents();
    getNotifs();
});