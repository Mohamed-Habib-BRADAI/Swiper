import Support from '../../utils/support';
import Utils from '../../utils/utils';
import Device from '../../utils/device';

function getOffset(swiper, slide, translate, scale, slideWidth) {
  return Math.abs(translate * (-1) - slide[0].swiperSlideOffset + ((((100 - slideWidth) / 100) * swiper.width) / 2));
}

function getOffsetBounds(swiper) {
  return {
    small: swiper.width * 0.05,
    intermediate: swiper.width * 0.2,
  };
}

function getScale(index, closestIndex, scale, offset, offsetBounds, interpolate = false) {
  // scale > 1 => scale up centered
  if (scale > 1) {
    if (index === closestIndex) {
      if (offset < offsetBounds.small) {
        return scale;
      }
      if (interpolate && offset < offsetBounds.intermediate) {
        return scale - (((offset - offsetBounds.small) / (offsetBounds.intermediate - offsetBounds.small)) * (scale - 1));
      }
    }
    return 1;
  }
  // scale <= 1 => scale down others
  if (index === closestIndex) {
    if (offset < offsetBounds.small) {
      return 1;
    }
    if (interpolate && offset < offsetBounds.intermediate) {
      return scale + (((offset - offsetBounds.small) / (offsetBounds.intermediate - offsetBounds.small)) * (1 - scale));
    }
  }
  return scale;
}

function getOpacity(index, closestIndex, opacity, offset, offsetBounds, interpolate = false) {
  if (index === closestIndex) {
    if (offset < offsetBounds.small) {
      return 1;
    }
    if (interpolate && offset < offsetBounds.intermediate) {
      return 1 - (((offset - offsetBounds.small) / (offsetBounds.intermediate - offsetBounds.small)) * (1 - opacity));
    }
    return opacity;
  }
  return opacity;
}

function animationStep(timestamp, start, callback, duration = 300) {
  const progress = timestamp - start;
  if (progress < duration) {
    callback(progress / duration);
    window.requestAnimationFrame(time => animationStep(time, start, callback));
  }
}

function animate(callback, easingFunction = t => t * (2 - t), duration = 300) {
  const start = window.performance.now();
  return window.requestAnimationFrame(time => animationStep(time, start, progress => callback(easingFunction(progress)), duration));
}

function getTranslateXY(transform) {
  const transArr = [];
  let mat = transform.match(/^matrix3d\((.+)\)$/);
  if (mat) {
    return parseFloat(mat[1].split(', ')[13]);
  }
  mat = transform.match(/^matrix\((.+)\)$/);
  if (mat) {
    transArr.push(parseFloat(mat[1].split(', ')[4]));
    transArr.push(parseFloat(mat[1].split(', ')[5]));
  }
  return transArr;
}

const Float = {
  setTranslate() {
    const swiper = this;
    const translate = swiper.translate;
    const params = swiper.params.floatEffect;
    const initialTranslate = getTranslateXY(swiper.$wrapperEl.css('transform'))[0];
    const transition = parseInt(swiper.$wrapperEl[0].style.transitionDuration, 10);
    const slides = Array.from(swiper.slides).map((slide, index) => swiper.slides.eq(index));
    const closestIndex = slides.reduce((result, slide, index) => {
      const lastValue = Math.abs(translate * (-1) - (slides[result][0].swiperSlideOffset - (slides[result][0].offsetWidth / 2)));
      const currentValue = Math.abs(translate * (-1) - (slides[index][0].swiperSlideOffset - (slides[result][0].offsetWidth / 2)));
      return currentValue < lastValue ? index : result;
    }, 0);

    if (!transition || (!Device.ios)) {
      if (Support.transforms3d) {
        swiper.$wrapperEl.transform(`translate3d(${translate}px, ${0}px, ${0}px)`);
      } else {
        swiper.$wrapperEl.transform(`translate(${translate}px, ${0}px)`);
      }

      const offsetBounds = getOffsetBounds(swiper);

      slides.forEach((slide, index) => {
        const offset = getOffset(swiper, slide, translate, params.scale, params.slideWidth);
        const scale = getScale(index, closestIndex, params.scale, offset, offsetBounds, Device.ios);
        const opacity = getOpacity(index, closestIndex, params.opacity, offset, offsetBounds, Device.ios);
        slide.transform(`scale(${scale}) translateZ(0)`);
        slide.css('opacity', opacity);
      });
    } else {
      const styles = slides.map(slide => ({
        scale: slide[0].getBoundingClientRect().width / slide[0].offsetWidth,
        opacity: parseFloat(window.getComputedStyle(slide[0]).opacity),
      }));

      const translateDelta = translate - initialTranslate;
      animate((progress) => {
        swiper.$wrapperEl.transform(`translateX(${initialTranslate + (translateDelta * progress)}px)`);
        slides.forEach((slide, index) => {
          const {scale, opacity} = styles[index];
          if (index === closestIndex) {
            slide.transform(`scale(${scale + ((params.scale - scale) * progress)}) translateZ(0)`);
            slide.css('opacity', opacity + ((1 - opacity) * progress));
          } else {
            if (scale > 1) {
              slide.transform(`scale(${scale - (progress * (scale - 1))}) translateZ(0)`);
            }
            if (opacity[index] > params.opacity) {
              slide.css('opacity', opacity - (progress * (opacity - params.opacity)));
            }
          }
        });
      });
    }
  },
};

export default {
  name: 'effect-float',
  params: {
    floatEffect: {
      scale: 1.07,
      opacity: 0.5,
      slideWidth: 82,
      spaceBetweenAsPercentage: false,
    },
  },
  create() {
    const swiper = this;
    Utils.extend(swiper, {
      floatEffect: {
        setTranslate: Float.setTranslate.bind(swiper),
      },
    });
  },
  on: {
    beforeInit() {
      const swiper = this;
      if (swiper.params.effect !== 'float') return;

      swiper.classNames.push(`${swiper.params.containerModifierClass}float`);
      swiper.classNames.push(`${swiper.params.containerModifierClass}3d`);

      if (Device.ios) {
        swiper.$wrapperEl.css('transition-property', 'none');
      } else {
        swiper.$wrapperEl.css('transition-property', 'transform, -webkit-transform');
      }

      swiper.params.watchSlidesProgress = true;
      swiper.originalParams.watchSlidesProgress = true;
      swiper.params.virtualTranslate = true;
      swiper.originalParams.virtualTranslate = true;

      const originalSpaceBetween = swiper.params.spaceBetween;

      if (swiper.params.floatEffect.spaceBetweenAsPercentage) {
        swiper.params.spaceBetween = `${originalSpaceBetween}%`;
        swiper.originalParams.spaceBetween = `${originalSpaceBetween}%`;
      }

      const oldStyles = document.getElementById('swiper-float-styles');
      if (oldStyles && oldStyles.parentNode) {
        oldStyles.parentNode.removeChild(oldStyles);
      }

      const style = document.createElement('style');
      style.setAttribute('id', 'swiper-float-styles');
      style.appendChild(document.createTextNode(''));
      document.head.appendChild(style);
      style.sheet.insertRule(`.swiper-container-float .swiper-wrapper .swiper-slide {width: ${swiper.params.floatEffect.slideWidth}% !important; }`);

    },
    init() {
      const swiper = this;
      const params = swiper.params;
      if (!Device.ios) {
        swiper.slides.transition(params.speed);
      }
    },
    setTranslate() {
      const swiper = this;
      if (swiper.params.effect !== 'float') return;
      swiper.floatEffect.setTranslate();
    },
    resize() {
      const swiper = this;
      console.log('resize');
    },
  },
};
