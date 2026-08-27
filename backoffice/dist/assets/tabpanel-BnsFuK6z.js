import{Gt as e,H as t,Jn as n,Kt as r,Mt as i,P as a,Q as o,S as s,T as c,Ut as l,Wt as u,Y as d,b as f,bn as p,bt as m,ct as h,et as g,fn as _,pn as v,q as y,rn as b,sn as x,un as S,vt as C,xn as w,xt as T,zt as E}from"./useApi-CROJJdhE-C1qgtaDP.js";import{w as D}from"./index-DdqaRqa9.js";import{t as O}from"./chevronleft-DoLeA2xd.js";import{t as k}from"./chevronright-BLj26IDt.js";var A=c.extend({name:`tabs`,style:`
    .p-tabs {
        display: flex;
        flex-direction: column;
    }

    .p-tablist {
        display: flex;
        position: relative;
        overflow: hidden;
        background: dt('tabs.tablist.background');
    }

    .p-tablist-viewport {
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        scrollbar-width: none;
        overscroll-behavior: contain auto;
    }

    .p-tablist-viewport::-webkit-scrollbar {
        display: none;
    }

    .p-tablist-tab-list {
        position: relative;
        display: flex;
        border-style: solid;
        border-color: dt('tabs.tablist.border.color');
        border-width: dt('tabs.tablist.border.width');
    }

    .p-tablist-content {
        flex-grow: 1;
    }

    .p-tablist-nav-button {
        all: unset;
        position: absolute !important;
        flex-shrink: 0;
        inset-block-start: 0;
        z-index: 2;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: dt('tabs.nav.button.background');
        color: dt('tabs.nav.button.color');
        width: dt('tabs.nav.button.width');
        transition:
            color dt('tabs.transition.duration'),
            outline-color dt('tabs.transition.duration'),
            box-shadow dt('tabs.transition.duration');
        box-shadow: dt('tabs.nav.button.shadow');
        outline-color: transparent;
        cursor: pointer;
    }

    .p-tablist-nav-button:focus-visible {
        z-index: 1;
        box-shadow: dt('tabs.nav.button.focus.ring.shadow');
        outline: dt('tabs.nav.button.focus.ring.width') dt('tabs.nav.button.focus.ring.style') dt('tabs.nav.button.focus.ring.color');
        outline-offset: dt('tabs.nav.button.focus.ring.offset');
    }

    .p-tablist-nav-button:hover {
        color: dt('tabs.nav.button.hover.color');
    }

    .p-tablist-prev-button {
        inset-inline-start: 0;
    }

    .p-tablist-next-button {
        inset-inline-end: 0;
    }

    .p-tablist-prev-button:dir(rtl),
    .p-tablist-next-button:dir(rtl) {
        transform: rotate(180deg);
    }

    .p-tab {
        flex-shrink: 0;
        cursor: pointer;
        user-select: none;
        position: relative;
        border-style: solid;
        white-space: nowrap;
        gap: dt('tabs.tab.gap');
        background: dt('tabs.tab.background');
        border-width: dt('tabs.tab.border.width');
        border-color: dt('tabs.tab.border.color');
        color: dt('tabs.tab.color');
        padding: dt('tabs.tab.padding');
        font-weight: dt('tabs.tab.font.weight');
        transition:
            background dt('tabs.transition.duration'),
            border-color dt('tabs.transition.duration'),
            color dt('tabs.transition.duration'),
            outline-color dt('tabs.transition.duration'),
            box-shadow dt('tabs.transition.duration');
        margin: dt('tabs.tab.margin');
        outline-color: transparent;
    }

    .p-tab:not(.p-disabled):focus-visible {
        z-index: 1;
        box-shadow: dt('tabs.tab.focus.ring.shadow');
        outline: dt('tabs.tab.focus.ring.width') dt('tabs.tab.focus.ring.style') dt('tabs.tab.focus.ring.color');
        outline-offset: dt('tabs.tab.focus.ring.offset');
    }

    .p-tab:not(.p-tab-active):not(.p-disabled):hover {
        background: dt('tabs.tab.hover.background');
        border-color: dt('tabs.tab.hover.border.color');
        color: dt('tabs.tab.hover.color');
    }

    .p-tab-active {
        background: dt('tabs.tab.active.background');
        border-color: dt('tabs.tab.active.border.color');
        color: dt('tabs.tab.active.color');
    }

    .p-tabpanels {
        background: dt('tabs.tabpanel.background');
        color: dt('tabs.tabpanel.color');
        padding: dt('tabs.tabpanel.padding');
        outline: 0 none;
    }

    .p-tabpanel:focus-visible {
        box-shadow: dt('tabs.tabpanel.focus.ring.shadow');
        outline: dt('tabs.tabpanel.focus.ring.width') dt('tabs.tabpanel.focus.ring.style') dt('tabs.tabpanel.focus.ring.color');
        outline-offset: dt('tabs.tabpanel.focus.ring.offset');
    }

    .p-tablist-active-bar {
        z-index: 1;
        display: block;
        position: absolute;
        inset-block-end: dt('tabs.active.bar.bottom');
        height: dt('tabs.active.bar.height');
        background: dt('tabs.active.bar.background');
        transition: 250ms cubic-bezier(0.35, 0, 0.25, 1);
    }
`,classes:{root:function(e){return[`p-tabs p-component`,{"p-tabs-scrollable":e.props.scrollable}]}}}),j={name:`Tabs`,extends:{name:`BaseTabs`,extends:s,props:{value:{type:[String,Number],default:void 0},lazy:{type:Boolean,default:!1},scrollable:{type:Boolean,default:!1},showNavigators:{type:Boolean,default:!0},tabindex:{type:Number,default:0},selectOnFocus:{type:Boolean,default:!1}},style:A,provide:function(){return{$pcTabs:this,$parentInstance:this}}},inheritAttrs:!1,emits:[`update:value`],data:function(){return{d_value:this.value}},watch:{value:function(e){this.d_value=e}},methods:{updateValue:function(e){this.d_value!==e&&(this.d_value=e,this.$emit(`update:value`,e))},isVertical:function(){return this.orientation===`vertical`}}};function M(e,t,n,i,a,o){return x(),r(`div`,b({class:e.cx(`root`)},e.ptmi(`root`)),[S(e.$slots,`default`)],16)}j.render=M;var N=c.extend({name:`tablist`,classes:{root:`p-tablist`,content:`p-tablist-content p-tablist-viewport`,tabList:`p-tablist-tab-list`,activeBar:`p-tablist-active-bar`,prevButton:`p-tablist-prev-button p-tablist-nav-button`,nextButton:`p-tablist-next-button p-tablist-nav-button`}}),P={name:`TabList`,extends:{name:`BaseTabList`,extends:s,props:{},style:N,provide:function(){return{$pcTabList:this,$parentInstance:this}}},inheritAttrs:!1,inject:[`$pcTabs`],data:function(){return{isPrevButtonEnabled:!1,isNextButtonEnabled:!0}},resizeObserver:void 0,inkBarObserver:void 0,watch:{showNavigators:function(e){e?this.bindResizeObserver():this.unbindResizeObserver()},activeValue:{flush:`post`,handler:function(){this.updateInkBar(),this.bindInkBarObserver()}}},mounted:function(){var e=this;setTimeout(function(){e.updateInkBar(),e.bindInkBarObserver()},150),this.showNavigators&&(this.updateButtonState(),this.bindResizeObserver())},updated:function(){this.showNavigators&&this.updateButtonState()},beforeUnmount:function(){this.unbindResizeObserver(),this.unbindInkBarObserver()},methods:{onScroll:function(e){this.showNavigators&&this.updateButtonState(),e.preventDefault()},onPrevButtonClick:function(){var e=this.$refs.content,t=this.getVisibleButtonWidths(),n=d(e)-t,r=Math.abs(e.scrollLeft)-n*.8,i=Math.max(r,0);e.scrollLeft=g(e)?-1*i:i},onNextButtonClick:function(){var e=this.$refs.content,t=this.getVisibleButtonWidths(),n=d(e)-t,r=Math.abs(e.scrollLeft)+n*.8,i=e.scrollWidth-n,a=Math.min(r,i);e.scrollLeft=g(e)?-1*a:a},bindResizeObserver:function(){var e=this;this.resizeObserver=new ResizeObserver(function(){return e.updateButtonState()}),this.resizeObserver.observe(this.$refs.list)},unbindResizeObserver:function(){var e;(e=this.resizeObserver)==null||e.unobserve(this.$refs.list),this.resizeObserver=void 0},bindInkBarObserver:function(){var e=this;this.unbindInkBarObserver();var t=this.$refs.content,n=m(t,`[data-pc-name="tab"][data-p-active="true"]`);n&&(this.inkBarObserver=new ResizeObserver(function(){return e.updateInkBar()}),this.inkBarObserver.observe(n))},unbindInkBarObserver:function(){var e;(e=this.inkBarObserver)==null||e.disconnect(),this.inkBarObserver=void 0},updateInkBar:function(){var e=this.$refs,n=e.content,r=e.inkbar,i=e.tabs;if(r){var o=m(n,`[data-pc-name="tab"][data-p-active="true"]`);this.$pcTabs.isVertical()?(r.style.height=a(o)+`px`,r.style.top=t(o).top-t(i).top+`px`):(r.style.width=C(o)+`px`,r.style.left=t(o).left-t(i).left+`px`)}},updateButtonState:function(){var e=this.$refs,t=e.list,n=e.content,r=n.scrollTop,i=n.scrollWidth,a=n.scrollHeight,s=n.offsetWidth,c=n.offsetHeight,l=Math.abs(n.scrollLeft),u=[d(n),o(n)],f=u[0],p=u[1];this.$pcTabs.isVertical()?(this.isPrevButtonEnabled=r!==0,this.isNextButtonEnabled=t.offsetHeight>=c&&parseInt(r)!==a-p):(this.isPrevButtonEnabled=l!==0,this.isNextButtonEnabled=t.offsetWidth>=s&&parseInt(l)!==i-f)},getVisibleButtonWidths:function(){var e=this.$refs,t=e.prevButton,n=e.nextButton,r=0;return this.showNavigators&&(r=(t?.offsetWidth||0)+(n?.offsetWidth||0)),r}},computed:{templates:function(){return this.$pcTabs.$slots},activeValue:function(){return this.$pcTabs.d_value},showNavigators:function(){return this.$pcTabs.showNavigators},prevButtonAriaLabel:function(){return this.$primevue.config.locale.aria?this.$primevue.config.locale.aria.previous:void 0},nextButtonAriaLabel:function(){return this.$primevue.config.locale.aria?this.$primevue.config.locale.aria.next:void 0},dataP:function(){return T({scrollable:this.$pcTabs.scrollable})}},components:{ChevronLeftIcon:O,ChevronRightIcon:k},directives:{ripple:f}},F=[`data-p`],I=[`aria-label`,`tabindex`],L=[`data-p`],R=[`aria-orientation`],z=[`aria-label`,`tabindex`];function B(t,n,i,a,o,s){var c=_(`ripple`);return x(),r(`div`,b({ref:`list`,class:t.cx(`root`),"data-p":s.dataP},t.ptmi(`root`)),[s.showNavigators&&o.isPrevButtonEnabled?w((x(),r(`button`,b({key:0,ref:`prevButton`,type:`button`,class:t.cx(`prevButton`),"aria-label":s.prevButtonAriaLabel,tabindex:s.$pcTabs.tabindex,onClick:n[0]||=function(){return s.onPrevButtonClick&&s.onPrevButtonClick.apply(s,arguments)}},t.ptm(`prevButton`),{"data-pc-group-section":`navigator`}),[(x(),u(v(s.templates.previcon||`ChevronLeftIcon`),b({"aria-hidden":`true`},t.ptm(`prevIcon`)),null,16))],16,I)),[[c]]):e(``,!0),l(`div`,b({ref:`content`,class:t.cx(`content`),onScroll:n[1]||=function(){return s.onScroll&&s.onScroll.apply(s,arguments)},"data-p":s.dataP},t.ptm(`content`)),[l(`div`,b({ref:`tabs`,class:t.cx(`tabList`),role:`tablist`,"aria-orientation":s.$pcTabs.orientation||`horizontal`},t.ptm(`tabList`)),[S(t.$slots,`default`),l(`span`,b({ref:`inkbar`,class:t.cx(`activeBar`),role:`presentation`,"aria-hidden":`true`},t.ptm(`activeBar`)),null,16)],16,R)],16,L),s.showNavigators&&o.isNextButtonEnabled?w((x(),r(`button`,b({key:1,ref:`nextButton`,type:`button`,class:t.cx(`nextButton`),"aria-label":s.nextButtonAriaLabel,tabindex:s.$pcTabs.tabindex,onClick:n[2]||=function(){return s.onNextButtonClick&&s.onNextButtonClick.apply(s,arguments)}},t.ptm(`nextButton`),{"data-pc-group-section":`navigator`}),[(x(),u(v(s.templates.nexticon||`ChevronRightIcon`),b({"aria-hidden":`true`},t.ptm(`nextIcon`)),null,16))],16,z)),[[c]]):e(``,!0)],16,F)}P.render=B;var V=c.extend({name:`tab`,classes:{root:function(e){var t=e.instance,n=e.props;return[`p-tab`,{"p-tab-active":t.active,"p-disabled":n.disabled}]}}}),H={name:`Tab`,extends:{name:`BaseTab`,extends:s,props:{value:{type:[String,Number],default:void 0},disabled:{type:Boolean,default:!1},as:{type:[String,Object],default:`BUTTON`},asChild:{type:Boolean,default:!1}},style:V,provide:function(){return{$pcTab:this,$parentInstance:this}}},inheritAttrs:!1,inject:[`$pcTabs`,`$pcTabList`],methods:{onFocus:function(){this.$pcTabs.selectOnFocus&&this.changeActiveValue()},onClick:function(){this.changeActiveValue()},onKeydown:function(e){switch(e.code){case`ArrowRight`:this.onArrowRightKey(e);break;case`ArrowLeft`:this.onArrowLeftKey(e);break;case`Home`:this.onHomeKey(e);break;case`End`:this.onEndKey(e);break;case`PageDown`:this.onPageDownKey(e);break;case`PageUp`:this.onPageUpKey(e);break;case`Enter`:case`NumpadEnter`:case`Space`:this.onEnterKey(e)}},onArrowRightKey:function(e){var t=this.findNextTab(e.currentTarget);t?this.changeFocusedTab(e,t):this.onHomeKey(e),e.preventDefault()},onArrowLeftKey:function(e){var t=this.findPrevTab(e.currentTarget);t?this.changeFocusedTab(e,t):this.onEndKey(e),e.preventDefault()},onHomeKey:function(e){var t=this.findFirstTab();this.changeFocusedTab(e,t),e.preventDefault()},onEndKey:function(e){var t=this.findLastTab();this.changeFocusedTab(e,t),e.preventDefault()},onPageDownKey:function(e){this.scrollInView(this.findLastTab()),e.preventDefault()},onPageUpKey:function(e){this.scrollInView(this.findFirstTab()),e.preventDefault()},onEnterKey:function(e){this.changeActiveValue()},findNextTab:function(e){var t=arguments.length>1&&arguments[1]!==void 0&&arguments[1]?e:e.nextElementSibling;return t?y(t,`data-p-disabled`)||y(t,`data-pc-section`)===`activebar`?this.findNextTab(t):m(t,`[data-pc-name="tab"]`):null},findPrevTab:function(e){var t=arguments.length>1&&arguments[1]!==void 0&&arguments[1]?e:e.previousElementSibling;return t?y(t,`data-p-disabled`)||y(t,`data-pc-section`)===`activebar`?this.findPrevTab(t):m(t,`[data-pc-name="tab"]`):null},findFirstTab:function(){return this.findNextTab(this.$pcTabList.$refs.tabs.firstElementChild,!0)},findLastTab:function(){return this.findPrevTab(this.$pcTabList.$refs.tabs.lastElementChild,!0)},changeActiveValue:function(){this.$pcTabs.updateValue(this.value)},changeFocusedTab:function(e,t){h(t),this.scrollInView(t)},scrollInView:function(e){var t;e==null||(t=e.scrollIntoView)==null||t.call(e,{block:`nearest`})}},computed:{active:function(){return i(this.$pcTabs?.d_value,this.value)},id:function(){return`${this.$pcTabs?.$id}_tab_${this.value}`},ariaControls:function(){return`${this.$pcTabs?.$id}_tabpanel_${this.value}`},attrs:function(){return b(this.asAttrs,this.a11yAttrs,this.ptmi(`root`,this.ptParams))},asAttrs:function(){return this.as===`BUTTON`?{type:`button`,disabled:this.disabled}:void 0},a11yAttrs:function(){return{id:this.id,tabindex:this.active?this.$pcTabs.tabindex:-1,role:`tab`,"aria-selected":this.active,"aria-controls":this.ariaControls,"data-pc-name":`tab`,"data-p-disabled":this.disabled,"data-p-active":this.active,onFocus:this.onFocus,onKeydown:this.onKeydown}},ptParams:function(){return{context:{active:this.active}}},dataP:function(){return T({active:this.active})}},directives:{ripple:f}};function U(e,t,r,i,a,o){var s=_(`ripple`);return e.asChild?S(e.$slots,`default`,{key:1,dataP:o.dataP,class:n(e.cx(`root`)),active:o.active,a11yAttrs:o.a11yAttrs,onClick:o.onClick}):w((x(),u(v(e.as),b({key:0,class:e.cx(`root`),"data-p":o.dataP,onClick:o.onClick},o.attrs),{default:p(function(){return[S(e.$slots,`default`)]}),_:3},16,[`class`,`data-p`,`onClick`])),[[s]])}H.render=U;var W=c.extend({name:`tabpanels`,classes:{root:`p-tabpanels`}}),G={name:`TabPanels`,extends:{name:`BaseTabPanels`,extends:s,props:{},style:W,provide:function(){return{$pcTabPanels:this,$parentInstance:this}}},inheritAttrs:!1};function K(e,t,n,i,a,o){return x(),r(`div`,b({class:e.cx(`root`),role:`presentation`},e.ptmi(`root`)),[S(e.$slots,`default`)],16)}G.render=K;var q=c.extend({name:`tabpanel`,classes:{root:function(e){return[`p-tabpanel`,{"p-tabpanel-active":e.instance.active}]}}}),J={name:`TabPanel`,extends:{name:`BaseTabPanel`,extends:s,props:{value:{type:[String,Number],default:void 0},as:{type:[String,Object],default:`DIV`},asChild:{type:Boolean,default:!1},header:null,headerStyle:null,headerClass:null,headerProps:null,headerActionProps:null,contentStyle:null,contentClass:null,contentProps:null,disabled:Boolean},style:q,provide:function(){return{$pcTabPanel:this,$parentInstance:this}}},inheritAttrs:!1,inject:[`$pcTabs`],computed:{active:function(){return i(this.$pcTabs?.d_value,this.value)},id:function(){return`${this.$pcTabs?.$id}_tabpanel_${this.value}`},ariaLabelledby:function(){return`${this.$pcTabs?.$id}_tab_${this.value}`},attrs:function(){return b(this.a11yAttrs,this.ptmi(`root`,this.ptParams))},a11yAttrs:function(){return{id:this.id,tabindex:this.$pcTabs?.tabindex,role:`tabpanel`,"aria-labelledby":this.ariaLabelledby,"data-pc-name":`tabpanel`,"data-p-active":this.active}},ptParams:function(){return{context:{active:this.active}}}}};function Y(t,i,a,o,s,c){var l,d;return c.$pcTabs?(x(),r(E,{key:1},[t.asChild?S(t.$slots,`default`,{key:1,class:n(t.cx(`root`)),active:c.active,a11yAttrs:c.a11yAttrs}):(x(),r(E,{key:0},[!((l=c.$pcTabs)!=null&&l.lazy)||c.active?w((x(),u(v(t.as),b({key:0,class:t.cx(`root`)},c.attrs),{default:p(function(){return[S(t.$slots,`default`)]}),_:3},16,[`class`])),[[D,(d=c.$pcTabs)!=null&&d.lazy?!0:c.active]]):e(``,!0)],64))],64)):S(t.$slots,`default`,{key:0})}J.render=Y;export{j as a,P as i,G as n,H as r,J as t};