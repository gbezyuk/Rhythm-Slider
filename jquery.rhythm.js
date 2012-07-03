/*
 * @author Grigoriy Beziuk
 * @e-mail gbezyuk@gmail.com
 *
 * @license
 * ----------------------------------------------------------------------------
 * "THE VEGETARIAN-FOOD-WARE LICENSE" (Revision 1):
 * Grigoriy Beziuk <gbezyuk@gmail.com> wrote this software. As long as you retain this notice you
 * can do whatever you want with this stuff. If we meet some day, and you think
 * this stuff is worth it, you can feed me with some tasty vegetarian food.
 * ----------------------------------------------------------------------------
 *
 * This script handles slider behaviour. It is supposed to replace jquery-carousel script in some cases.
 *
 * Features:
 * -------------
 *  - slider for picture changing
 *  - horizontal rhythm auto support
 *  - autoscrolling
 *  - scrolling by clicking left and right buttons
 *  - auto image size detection
 *  - maximal and minimal images count support (?)
 *
 * Basic idea:
 * -----------
 * Each $li element has its own width, and that's enough for us.
 * We operate $li's margin-right css property to support autorhythming.
 * Instead of actual scrolling we use $li width animation.
 *
 * Terms:
 * ------
 *  Slider - global container with slides and controls
 *  Slide - a $li element
 *  Visible Slide - slide currently visible on site
 *  Hidden Slide - slide currently hidden
 *  Slide Width - width of image contained by a Slide
 *  Slider Step - transition to previous or next slide.
 *      Usually one visible slide becomes hidden and one hidden slide becomes visible during transition.
 *  Slider Capacity - count of Slides able to be visible in a single moment. Shortcuted as SC.
 *  Slider Button - a control making slider to perform a step. There are usually two buttons: prev & next..
 *
 * methods:
 * --------
 * - align_visible_slides():
 *      puts calculated margin-rights to every visible element except last one;
 *      at the same time resets to zero margins of all other elements (?)
 * - step_slider(direction):
 *      performes a slider step. Calls align_visible_slides() inside itself.
 *
 * workflow (briefly):
 * -------------------
 * 1. layout is loaded
 * 2. taking first SC slides, aligning 'em (performing a step with no direction)
 * 3. on slider button click performing slider step and slides alignment (inside step procedure)
 *
 * Slider step mechanics:
 * ----------------------
 * Each time performing a slider step we move the first slide to the tail, or the last one to the slider
 * head (depending on step direction). So no actual scrolling occurs, but a circular slide exchange.
 * Animation is a tricky question here.
 *
 * Example:
 * --------
 * Assume we have SC=4 and number of slides is 6:
 * state 1: [1 2 3 4] 5 6
 * state 2: 1 [2 3 4 5] 6   is really   [2 3 4 5] 6 1
 * state 3: 1 2 [3 4 5 6]   is really   [3 4 5 6] 1 2
 * state 4: 1] 2 3 [4 5 6   is really   [4 5 6 1] 2 3
 * state 5: 1 2] 3 4 [5 6   is really   [5 6 1 2] 3 4
 * state 6: 1 2 3] 4 5 [6   is really   [6 1 2 3] 4 5
 * state 7 == state 1
 *
 * Transition animation:
 * ---------------------
 * A) Consider transition from state 1 to state 2 (direct transition):
 * start:   visible slides: [1, 2, 3, 4]
 *          hidden slides: [5, 6]
 * finish:  visible slides [2, 3, 4, 5]
 *          hidden slides: [6, 1]
 * difference:
 *  slide 5 shows up, slide 1 hides down and moves from slider head to slider tail (being hidden)
 *  slide 5 is first hidden slide
 *  slide 1 is first visible slide
 *  so, first hidden slide shows up and first visible slide hides down and moves to tail being hidden
 * B) Consider transition from state 2 to state 1 (reverse transition):
 * start:   visible slides: [2, 3, 4, 5]
 *          hidden slides: [6, 1]
 * finish:  visible slides [1, 2, 3, 4]
 *          hidden slides: [5, 6]
 * difference:
 *  slide 1 shows up, slide 5 hides down and moves from slider tail to slider head (being hidden)
 *  slide 1 is last hidden slide
 *  slide 5 is last visible slide
 *  so, situation is same as direct transition, yet mirrored
 *
 * What happens if SC == number of slides?
 * ---------------------------------------
 * Actually, not transition, and slider is unnecessary here. Yet it is still functional:
 * |: [1 2 3] | [2 3 1] | [3 1 2] :|
 * The question is how to make a smooth animation, if element is appearing at one side of a slider,
 * and appearing at another at the exactly same time. The only available answer is slide duplication:
 * before animation: [1 2 3], no duplication
 * animation start: [1 2 3 1], slide 1 is duplicated. left one starts to disappear, right one starts to appear now.
 * animation end: [2 3 1], no duplication again: right one completely appeared, and left one is totally disappeared
 *
 * How about to use this as a common case? It's OK, yet the duplicated slide appearance is degenerated:
 * [1 2 3] 4 -> [1 2 3] 4 (1) -> [2 3 4] 1, so 1 is still hidden
 *
 */

/*
 * console.log safe wrapper with a short name
 */
function _cl() {
    if (typeof(console) == 'object' && typeof(console.log) == 'function') {
        console.log.apply(console, arguments);
    }
}

/*
 * Rhythm slider initialization
 */
function Rhythm($container) {
    this.$container = $container;
    this.ANIMATION_SPEED = 'slow';
    this.MAX_SLIDES_VISIBLE = 6;
    this.align();
    var self = this;
    this.$container.find('.button-prev').click(function () {
        self.prev();
    });
    this.$container.find('.button-next').click(function () {
        self.next();
    });
}

Rhythm.prototype = {

    _filter: function () {
        var self = this;
        var $ul = this.$container.find('>ul');
        var ul_width = $ul.width();
        var $filtered = $();
        var filtered_width = 0;
        var filtered_count = 0;
        $ul.children('li').each(function () {
            var $li = $(this);
            if ($li.hasClass('skip_me')) {
                return true;
            }
            var li_width = $li.find('img').width();
            if (filtered_width + li_width > ul_width || filtered_count == self.MAX_SLIDES_VISIBLE) {
                return false;
            }
            filtered_width += li_width;
            filtered_count += 1;
            $filtered = $filtered.add($li);
        });
        return {
            '$elements': $filtered,
            'width': filtered_width,
            'count': filtered_count,
            'ul_width': ul_width
        }
    },

    align: function () {
        var filtered = this._filter();
        var $last_one = $(filtered.$elements.get(filtered.count - 1));
        var $other_lis = this.$container.find('li').not(filtered.$elements);
        var margin_right = (filtered.ul_width - filtered.width) / (filtered.count - 1);
        $other_lis.removeClass('filtered').removeClass('last_one').animate({'margin-right': 0, 'width': 0}, this.ANIMATION_SPEED);
        filtered.$elements.addClass('filtered').not($last_one).removeClass('last_one').each(function () {
            var $li = $(this);
            var li_width = $li.find('img').width();
            $li.animate({'margin-right': margin_right, 'width': li_width}, this.ANIMATION_SPEED);
        });
        $last_one.addClass('last_one').animate({'margin-right': 0, 'width': $last_one.find('img').width()}, this.ANIMATION_SPEED);
    },

    prev: function () {
        var $ul = this.$container.find('>ul');
        var $li = $($ul.children('li:first-child').get(0));
        var $li_copy = $li.clone();
        $li.addClass('skip_me');
        $li_copy.appendTo($ul).width(0);
        $li.animate({'width': 0, 'margin-right': 0}, function () {
            $(this).remove();
        });
        this.align();
    },

    next: function () {
        var $ul = this.$container.find('>ul');
        var $li = $($ul.children('li:last-child').get(0));
        var $li_copy = $li.clone();
        $li.addClass('skip_me');
        $li_copy.prependTo($ul).width(0);
        $li.animate({/*'width': 0, 'margin-right': 0*/}, function () {
            $(this).remove();
        });
        this.align();
    }
};

(function ($) {
    $.fn.rhythm = function () {
        $(this).each(function () {
            var $node = $(this);
            var r = new Rhythm($node);
        });
    };
})(jQuery);