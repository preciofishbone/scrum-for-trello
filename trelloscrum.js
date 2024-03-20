/*
** Scrum for Trello- https://github.com/Q42/TrelloScrum
** Adds Scrum to your Trello
**
** Original:
** Jasper Kaizer <https://github.com/jkaizer>
** Marcel Duin <https://github.com/marcelduin>
**
** Contribs:
** Paul Lofte <https://github.com/paullofte>
** Nic Pottier <https://github.com/nicpottier>
** Bastiaan Terhorst <https://github.com/bastiaanterhorst>
** Morgan Craft <https://github.com/mgan59>
** Frank Geerlings <https://github.com/frankgeerlings>
** Cedric Gatay <https://github.com/CedricGatay>
** Kit Glennon <https://github.com/kitglen>
** Samuel Gaus <https://github.com/gausie>
** Sean Colombo <https://github.com/seancolombo>
** Kevin Strong <https://github.com/KevinStrong>
**
** Fixes for Trello 2023 changes:
** Ken Swanson <https://github.com/Swandog>
** Gareth J M Saunders <https://github.com/garethjmsaunders/>
*/

// Thanks @unscriptable - http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
var debounce = function (func, threshold, execAsap) {
    var timeout;
    return function debounced () {
    	var obj = this, args = arguments;
		function delayed () {
			if (!execAsap)
				func.apply(obj, args);
			timeout = null; 
		};

		if (timeout)
			clearTimeout(timeout);
		else if (execAsap)
			func.apply(obj, args);

		timeout = setTimeout(delayed, threshold || 100);
	};
}

// For MutationObserver
var obsConfig = { childList: true, characterData: true, attributes: false, subtree: true };


var _ignoreTrelloElements = [
	'list',
	'list-total', 
	'list-title', 
	'list-header', 
	'list-footer',
	'date', // the 'time-ago' functionality changes date spans every minute
	'js-phrase', // this is constantly updated by Trello, but doesn't affect estimates.
	'member',
	'clearfix',
	'badge',
	'card-front-badges',
	'board-header',
	'board-name-display',
	'header-container',
	'header-btn-text',
	'undefined'
]

//internals
var iconUrl, pointsDoneUrl,
	estimatedUrl, plannedUrl, burnedUrl,
	summaryUrl;

// FIREFOX_BEGIN_REMOVE
if(typeof chrome !== 'undefined'){
    // Works in Chrome & FF 57.
    // FIREFOX_END_REMOVE
	iconUrl = chrome.runtime.getURL('images/storypoints-icon.png');
	estimatedUrl = chrome.runtime.getURL('images/light-bulb-svgrepo-com.svg');
	plannedUrl = chrome.runtime.getURL('images/clipboard-svgrepo-com.svg');
	burnedUrl = chrome.runtime.getURL('images/wrench-svgrepo-com.svg');
	summaryUrl = chrome.runtime.getURL('images/keynote-presentation-svgrepo-com.svg');
	// FIREFOX_BEGIN_REMOVE - This is for firefox review requirements. We can't have code that doesn't run in FF.
} else if(navigator.userAgent.indexOf('Safari') != -1){ // Chrome defines both "Chrome" and "Safari", so this test MUST be done after testing for Chrome
	// Works in Safari
	iconUrl = safari.extension.baseURI + 'images/storypoints-icon.png';
	estimatedUrl = safari.extension.baseURI + 'images/light-bulb-svgrepo-com.svg';
	plannedUrl = safari.extension.baseURI + 'images/clipboard-svgrepo-com.svg';
	burnedUrl = safari.extension.baseURI + 'images/wrench-svgrepo-com.svg';
	summaryUrl = safari.extension.baseURI + 'images/align-objects-bottom-svgrepo-com.svg';
} // FIREFOX_END_REMOVE


var _curlyPointsObj = {
	pointAttr: 'curlyPoints',
	class: 'curly-points',
	title: 'Planned Est',
	iconUrl: estimatedUrl,
	reg: /((?:^|\s?))\{(\x3f|\d*\.?\d+)(\})\s?/m, //parse regexp- accepts digits, decimals and '?', surrounded by {}
}
var _squarePointsObj = {
	pointAttr: 'squarePoints',
	class: 'square-points',
	title: 'Dev Est',
	iconUrl: plannedUrl,
	reg: /((?:^|\s?))\[(\x3f|\d*\.?\d+)(\])\s?/m, //parse regexp- accepts digits, decimals and '?', surrounded by []
}
var _pointsObj = {
	pointAttr: 'points',
	class: 'regular-points',
	title: 'Spent Hours',
	iconUrl: burnedUrl,
	reg: /((?:^|\s?))\((\x3f|\d*\.?\d+)(\))\s?/m, //parse regexp- accepts digits, decimals and '?', surrounded by ()
}
var _cardCountObj ={
	pointAttr: 'cardCount',
	class: 'card-count',
	title: 'Cards',
	iconUrl: iconUrl,
	reg: null
}

const _listColors =[
	{	styleColor: "gray", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false } ,
	{	styleColor: "green", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false	} ,
	{	styleColor: "yellow", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "orange", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "red", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "purple", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "blue", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "teal", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
	{	styleColor: "magenta", curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0, inUse: false },
];

//attributes representing points values for card
var _pointsTypes = [_cardCountObj, _pointsObj, _squarePointsObj, _curlyPointsObj];

function round(_val) {return (Math.round(_val * 100) / 100)};

// Comment out before release - makes cross-browser debugging easier.
//function log(msg){
//	if(typeof chrome !== 'undefined'){
//		console.log(msg);
//	} else {
//		$($('.header-btn-text').get(0)).text(msg);
//	}
//}

// Some browsers have serious errors with MutationObserver (eg: Safari doesn't have it called MutationObserver).
var CrossBrowser = {
	init: function(){
		this.MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver || null;
	}
};
CrossBrowser.init();

//what to do when DOM loads
$(function(){
	$('.js-toggle-label-filter, .js-select-member, .js-due-filter, .js-clear-all').off('mouseup');
	$('.js-toggle-label-filter, .js-select-member, .js-due-filter, .js-clear-all').on('mouseup', calcListPoints);
	$('.js-input').off('keyup');
	$('.js-input').on('keyup', calcListPoints);
	$('.js-share').off('mouseup');
	calcListPoints();
});

// Recalculates every card and its totals (used for significant DOM modifications).
var recalcListAndTotal = debounce(function($el){
    ($el||$("[data-testid='list']")).each(function(){
		if(!this.list) new List(this);
		else if(this.list.refreshList){
			this.list.refreshList(); // make sure each card's points are still accurate (also calls list.calc()).
		}
	})
}, 500, false);

var recalcTotalsObserver = new CrossBrowser.MutationObserver(function(mutations)
{
	// Determine if the mutation event included an ACTUAL change to the list rather than
	// a modification caused by this extension making an update to points, etc. (prevents
	// infinite recursion).
	var doFullRefresh = false;
	var refreshJustTotals = false;
	$.each(mutations, function(index, mutation){
		if (!doFullRefresh) {
			var $target = $(mutation.target);

			// Ignore a bunch of known cases that send mutation events which don't require us to recalcListAndTotal.
			if (!_ignoreTrelloElements.find(x => $target.hasClass(x) || $target.attr('data-testid') == x) && 
				($target.attr('data-testid') == null || $target.attr('data-testid').toLowerCase().indexOf('icon') < 0)) {
					doFullRefresh = true;
			}
		}
	});
	
	if(doFullRefresh){
		recalcListAndTotal();
	} else if(refreshJustTotals){
		calcListPoints();
	}
});
recalcTotalsObserver.observe(document.body, obsConfig);

var ignoreClicks = function(){ return false; };


var ctto;
function computeTotal(){
	clearTimeout(ctto);
	ctto = setTimeout(function(){
		var $title = $('.board-header-btns,#board-header a');
		var $totalWrapper = $title.children('.o-list-total-wrapper');
		if($totalWrapper.length == 0){
			$totalWrapper = $('<div/>', {class: "o-list-total-wrapper"}).prependTo($title);
		}
		var $total = $totalWrapper.children('.list-total').empty();
		if ($total.length == 0)
			$total = $('<span/>', {class: "list-total"}).prependTo($totalWrapper);

		for (var i in _pointsTypes){
			var score = 0,
				pointType = _pointsTypes[i];

			$('#board .list-total .'+pointType.class).each(function(){
				score+=parseFloat(this.textContent)||0;
			});

			$total.prepend($('<span/>', {class: pointType.class})
							.text(round(score)||'')
							.attr({title: 'Total of '+pointType.title }));
		}

		_listColors.forEach(function(listColor){
			listColor.cardCount = 0;
			listColor.curlyPoints = 0;
			listColor.squarePoints = 0;
			listColor.points = 0;
			listColor.inUse = false;
		});

		// For each list in board
		$("#board [data-testid='list']").each(function(_, el){
			const styleOnList = $(el).attr("style") || "";
			_listColors.forEach(function(listColor){
				if((listColor.styleColor == "gray" 
					&& (!styleOnList || styleOnList == "")) 
					|| styleOnList.indexOf("var(--ds-background-accent-" +listColor.styleColor+ "-subtler)") > -1)
				{
					listColor.inUse = true;
					listColor.cardCount += +($(el).find('.list-total .card-count').text() || 0);
					listColor.curlyPoints += +($(el).find('.list-total .'+_curlyPointsObj.class).text() || 0);
					listColor.squarePoints += +($(el).find('.list-total .'+_squarePointsObj.class).text() || 0);
					listColor.points += +($(el).find('.list-total .'+_pointsObj.class).text() || 0);
				}
			});
		});

		if($totalWrapper.find('.o-button').length == 0)
		{
			($('<button/>')
				.attr('title', 'Show summary')
				.addClass("board-header-btn o-button")
				.on('click', showSummaryDialog)
				.append($("<span/>")
					.addClass("o-button-icon")
					.attr('style', "mask-image: url("+summaryUrl+")")))
				.prependTo($totalWrapper);

		}
	});
};

//calculate list totals
var lto;
function calcListPoints(){
	clearTimeout(lto);
	lto = setTimeout(function(){
		$("[data-testid='list']").each(function(){
			if(!this.list) new List(this);
			else if(this.list.calc) this.list.calc();
		});
	});
};

//.list pseudo
function List(el){
	if(el.list)return;
	el.list=this;

	var $list=$(el),
		$total=$('<span class="o-list-header list-total">'),
		busy = false,
		to;

	function readCard($c){
		if($c.target) {
			if(!/list-card/.test($c.target.className)) return;
			$c = $($c.target).filter("[data-testid='list-card']:not(.placeholder)");
		}
		$c.each(function(){
			if(!this.listCard) for (var i in _pointsTypes){
				new ListCard(this,_pointsTypes[i]);
			} else {
				for (var i in _pointsTypes){
					setTimeout(this.listCard[_pointsTypes[i].pointAttr].refresh);
				}
			}
		});
	};

	// All calls to calc are throttled to happen no more than once every 500ms (makes page-load and recalculations much faster).
	var self = this;
	this.calc = debounce(function(){
		self._calcInner();
    }, 500, true); // executes right away unless over its 500ms threshold since the last execution


	this._calcInner	= function(e){ // don't call this directly. Call calc() instead.
		clearTimeout(to);
		to = setTimeout(function(){
			$total.empty().insertAfter($list.find("[data-testid='list-title'],[data-testid='list-header']"));
			for (var i in _pointsTypes){
				let score = 0;
				let pointType = _pointsTypes[i];
				if(pointType.reg){
					$list.find("[data-testid='list-card']:not(.placeholder)")
						.each(function(_, el){
							if(!el.listCard) 
							{
								return;
							}
							if(!isNaN(Number(el.listCard[pointType.pointAttr].points))){
								// Performance note: calling :visible in the selector above leads to noticible CPU usage.
								if(jQuery.expr.filters.visible(el)){
									score+=Number(el.listCard[pointType.pointAttr].points);
								}
							}
						});
				}
				else{
					$list.find("[data-testid='list-card']:not(.placeholder)")
						.each(function(_, el){
							if(!el.listCard) 
							{
								return;
							}
							if(jQuery.expr.filters.visible(el)){
								score++;
							}
						});
				}

				var scoreTruncated = round(score);
				if(scoreTruncated > 0)
				{
					$total.prepend($('<span/>', {class: pointType.class})
								.text((scoreTruncated>=0) ? scoreTruncated : '' )
								.attr({title: pointType.title + ' in list' }));
				}
			}
			computeTotal();
		});
	};
    
    this.refreshList = debounce(function(){
        readCard($list.find("[data-testid='list-card']:not(.placeholder)"));
        this.calc(); // readCard will call this.calc() if any of the cards get refreshed.
    }, 500, false);

	var cardAddedRemovedObserver = new CrossBrowser.MutationObserver(function(mutations)
	{
		// Determine if the mutation event included an ACTUAL change to the list rather than
		// a modification caused by this extension making an update to points, etc. (prevents
		// infinite recursion).
		$.each(mutations, function(index, mutation){
			var $target = $(mutation.target);
			
			// Ignore a bunch of known elements that send mutation events.
			if(! ($target.hasClass('list-total')
					|| $target.hasClass('list-title')
					|| $target.hasClass('list-header')
					|| $target.hasClass('badge-points')
					|| $target.hasClass('badges')
					|| (typeof mutation.target.className == "undefined")
					))
			{
				var list;
				// It appears this was an actual mutation and not a recursive notification.
				$list = $target.closest("[data-testid='list']");
				if($list.length > 0){
					list = $list.get(0).list;
					if(!list){
						list = new List(mutation.target);
					}
					if(list){
						list.refreshList(); // debounced, so its safe to call this multiple times for the same list in this loop.
					}
				}
			}
		});
	});

	setTimeout(function(){
		readCard($list.find("[data-testid='list-card']"));
		setTimeout(el.list.calc);
	});
};

//.list-card pseudo
function ListCard(el, pointType){
	if(el.listCard && el.listCard[pointType.pointAttr]) return;

	//lazily create object
	if (!el.listCard){
		el.listCard={};
	}
	el.listCard[pointType.pointAttr]=this;

	var points=-1,
		className=pointType.class,
		regexp=pointType.reg,
		parsed,
		that=this,
		busy=false,
		$card=$(el),
		$badge=$('<div class="badge badge-points point-count" />'),
		to,
		to2;

	// MutationObservers may send a bunch of similar events for the same card (also depends on browser) so
	// refreshes are debounced now.
	var self = this;
	this.refresh = debounce(function(){
		self._refreshInner();
    }, 250, true); // executes right away unless over its 250ms threshold
	this._refreshInner=function(){
		if(busy) {
			return;
		}
		
		busy = true;
		clearTimeout(to);

		to = setTimeout(function(){
			var $title=$card.find("[data-testid='card-name']");
			if(!$title[0]){
				busy = false;
				return;
			}

			if(!regexp){
				busy = false;
				return;
			}

			// This expression gets the right value whether Trello has the card-number span in the DOM or not (they recently removed it and added it back).
			var titleTextContent = (($title[0].childNodes.length > 1) ? $title[0].childNodes[$title[0].childNodes.length-1].textContent : $title[0].textContent);
			if(titleTextContent) el._title = titleTextContent;
			
			// Get the stripped-down (parsed) version without the estimates, that was stored after the last change.
			var parsedTitle = $title.data('parsed-title'); 

			if(titleTextContent != parsedTitle){
				// New card title, so we have to parse this new info to find the new amount of points.
				parsed=titleTextContent.match(regexp);
				points=parsed?parsed[2]:-1;
			} 
			else {
				// Title text has already been parsed... process the pre-parsed title to get the correct points.
				var origTitle = $title.data('orig-title');
				parsed=origTitle.match(regexp);
				points=parsed?parsed[2]:-1;
			}

			clearTimeout(to2);
			to2 = setTimeout(function(){
				$badge.empty();
				if(that.points > 0){
					// Add the badge (for this point-type: curly, square or regular) to the badges div.
					$badge.append($('<span/>', {class: 'o-badge-icon', style: "mask-image: url('"+pointType.iconUrl+"')"}));
					$badge.append($('<span/>', {class: 'o-badge-text'})
						.text(that.points));
					$badge
						['addClass'](className)
						.attr({title: 'This card has '+that.points+ ' ' + pointType.title })
						.prependTo($card.find("[data-testid='card-front-badges']"));
				}

				// Update the DOM element's textContent and data if there were changes.
				if(titleTextContent != parsedTitle){
					$title.data('orig-title', titleTextContent); // store the non-mutilated title (with all of the estimates/time-spent in it).
				}
				
				var tempParsedTitle = el._title;
				for (var i in _pointsTypes){
					tempParsedTitle = tempParsedTitle.replace(_pointsTypes[i].reg,'$1');
				}
				parsedTitle = $.trim(tempParsedTitle);
				el._title = parsedTitle;
				
				$title.data('parsed-title', parsedTitle); // save it to the DOM element so that both badge-types can refer back to it.
				if($title[0].childNodes.length > 1){
					$title[0].childNodes[$title[0].childNodes.length-1].textContent = parsedTitle; // if they keep the card numbers in the DOM
				} else {
					$title[0].textContent = parsedTitle; // if they yank the card numbers out of the DOM again.
				}

				var list = $card.closest("[data-testid='list']");
				if(list[0]){
					list[0].list.calc();
				}
				busy = false;
			});
		});
	};

	this.__defineGetter__('points',function(){
		return parsed?points:''
	});

	var cardShortIdObserver = new CrossBrowser.MutationObserver(function(mutations){
		$.each(mutations, function(index, mutation){
			var $target = $(mutation.target);
			if(mutation.addedNodes.length > 0){
				$.each(mutation.addedNodes, function(index, node){
					if($(node).hasClass('card-short-id')){
						// Found a card-short-id added to the DOM. Need to refresh this card.
						var listElement = $target.closest("[data-testid='list']").get(0);
						if(!listElement.list) new List(listElement); // makes sure the .list in the DOM has a List object

						var $card = $target.closest("[data-testid='list-card']");
						if($card.length > 0){
							var listCardHash = $card.get(0).listCard;
							if(listCardHash){
								// The hash contains a ListCard object for each type of points (cpoints, points, possibly more in the future).
								$.each(_pointsTypes, function(index, pointType){
									listCardHash[pointType.pointAttr].refresh();
								});
							}
						}
					}
				});
			}
		});
	});

	// The MutationObserver is only attached once per card (for the spent-hours ListCard) and that Observer will make the call
	// to update BOTH types of points-badges.
	if(pointType.pointAttr == _pointsObj.pointAttr){
		var observerConfig = { childList: true, characterData: false, attributes: false, subtree: true };
		cardShortIdObserver.observe(el, observerConfig);
	}

	setTimeout(that.refresh);
};

function showSummaryDialog(){
	var $dialog=$(`<div id="oSummaryModal" class="modal"/>`).appendTo('body');
	var $content=$(`<div class="modal-content"/>`).appendTo($dialog);
	var $header=$(`<div class="modal-header"/>`).appendTo($content);

	$header.append($('<div class="o-header"><span class="o-header-icon" style="mask-image: url('+ summaryUrl +')"></span><h2>Summary</h2></div>'));
	$header.append($('<span class="close">&times;</span>').on('click', function(){
		$("body").find("#oSummaryModal").remove();
	}));

	$modalBody = $(`<div class="modal-body o-summary"/>`).appendTo($content);
	$modalBody.append(
		$(`<div class="o-summary-row o-summary-header-row"/>`)
			.append($(`<div class="o-summary-item o-summary-header-item-empty"/>`))
			.append($(`<div class="o-summary-item o-summary-header-item"/>`).text("Planned Est"))
			.append($(`<div class="o-summary-item o-summary-header-item"/>`).text("Dev Est"))
			.append($(`<div class="o-summary-item o-summary-header-item"/>`).text("Spent Hours"))
			.append($(`<div class="o-summary-item o-summary-header-item"/>`).text("Cards"))
		);

	let total = {	curlyPoints: 0, squarePoints: 0, points: 0, cardCount: 0 };

	_listColors.forEach(function(listColor){
		if(listColor.inUse){
			total.curlyPoints += listColor.curlyPoints;
			total.squarePoints += listColor.squarePoints;
			total.points += listColor.points;
			total.cardCount += listColor.cardCount;

			$modalBody.append(
				$(`<div class="o-summary-row o-summary-item-row"/>`)
					.append($(`<div class="o-summary-item o-summary-row-item-color"/>`).attr("style", "background-color: var(--ds-background-accent-" + listColor.styleColor + "-subtler);"))
					.append($(`<div class="o-summary-item o-summary-row-item"/>`).text(listColor.curlyPoints))
					.append($(`<div class="o-summary-item o-summary-row-item"/>`).text(listColor.squarePoints))
					.append($(`<div class="o-summary-item o-summary-row-item"/>`).text(listColor.points))
					.append($(`<div class="o-summary-item o-summary-row-item"/>`).text(listColor.cardCount))
			);
		
		}
	});

	$modalBody.append(
		$(`<div class="o-summary-row o-summary-footer-row"/>`)
			.append($(`<div class="o-summary-item o-summary-footer-item-empty"/>`).text("Total"))
			.append($(`<div class="o-summary-item o-summary-footer-item"/>`).text(total.curlyPoints))
			.append($(`<div class="o-summary-item o-summary-footer-item"/>`).text(total.squarePoints))
			.append($(`<div class="o-summary-item o-summary-footer-item"/>`).text(total.points))
			.append($(`<div class="o-summary-item o-summary-footer-item"/>`).text(total.cardCount))
	);
	$content.append($(`<div class="modal-footer"/>`)
		.append($(`<button class="modal-button">Close</button>`)
		.on('click', function(){
			$("body").find("#oSummaryModal").remove();
		})));

  $dialog.attr("style", "display: block;");
}

window.URL = window.URL || window.webkitURL;
