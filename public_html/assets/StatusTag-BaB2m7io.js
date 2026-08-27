import{Gt as e,Jn as t,Kt as n,Pn as r,S as i,T as a,Ut as o,Wt as s,Zn as c,Zt as l,pn as u,rn as d,sn as f,un as p,xt as m}from"./useApi-CROJJdhE-C1qgtaDP.js";import{t as h}from"./_plugin-vue_export-helper-BDNMzG2s.js";var g=a.extend({name:`tag`,style:`
    .p-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: dt('tag.primary.background');
        color: dt('tag.primary.color');
        font-size: dt('tag.font.size');
        font-weight: dt('tag.font.weight');
        padding: dt('tag.padding');
        border-radius: dt('tag.border.radius');
        gap: dt('tag.gap');
    }

    .p-tag-icon {
        font-size: dt('tag.icon.size');
        width: dt('tag.icon.size');
        height: dt('tag.icon.size');
    }

    .p-tag-rounded {
        border-radius: dt('tag.rounded.border.radius');
    }

    .p-tag-success {
        background: dt('tag.success.background');
        color: dt('tag.success.color');
    }

    .p-tag-info {
        background: dt('tag.info.background');
        color: dt('tag.info.color');
    }

    .p-tag-warn {
        background: dt('tag.warn.background');
        color: dt('tag.warn.color');
    }

    .p-tag-danger {
        background: dt('tag.danger.background');
        color: dt('tag.danger.color');
    }

    .p-tag-secondary {
        background: dt('tag.secondary.background');
        color: dt('tag.secondary.color');
    }

    .p-tag-contrast {
        background: dt('tag.contrast.background');
        color: dt('tag.contrast.color');
    }
`,classes:{root:function(e){var t=e.props;return[`p-tag p-component`,{"p-tag-info":t.severity===`info`,"p-tag-success":t.severity===`success`,"p-tag-warn":t.severity===`warn`,"p-tag-danger":t.severity===`danger`,"p-tag-secondary":t.severity===`secondary`,"p-tag-contrast":t.severity===`contrast`,"p-tag-rounded":t.rounded}]},icon:`p-tag-icon`,label:`p-tag-label`}}),_={name:`BaseTag`,extends:i,props:{value:null,severity:null,rounded:Boolean,icon:String},style:g,provide:function(){return{$pcTag:this,$parentInstance:this}}};function v(e){"@babel/helpers - typeof";return v=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},v(e)}function y(e,t,n){return(t=b(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function b(e){var t=x(e,`string`);return v(t)==`symbol`?t:t+``}function x(e,t){if(v(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t);if(v(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}var S={name:`Tag`,extends:_,inheritAttrs:!1,computed:{dataP:function(){return m(y({rounded:this.rounded},this.severity,this.severity))}}},C=[`data-p`];function w(t,r,i,a,l,m){return f(),n(`span`,d({class:t.cx(`root`),"data-p":m.dataP},t.ptmi(`root`)),[t.$slots.icon?(f(),s(u(t.$slots.icon),d({key:0,class:t.cx(`icon`)},t.ptm(`icon`)),null,16,[`class`])):t.icon?(f(),n(`span`,d({key:1,class:[t.cx(`icon`),t.icon]},t.ptm(`icon`)),null,16)):e(``,!0),t.value!=null||t.$slots.default?p(t.$slots,`default`,{key:2},function(){return[o(`span`,d({class:t.cx(`label`)},t.ptm(`label`)),c(t.value),17)]}):e(``,!0)],16,C)}S.render=w;var T=h(l({__name:`StatusTag`,props:{label:{},family:{}},setup(e){return(n,i)=>(f(),s(r(S),{value:e.label,severity:e.family===`gold`?void 0:e.family,class:t(e.family===`gold`?`status-tag--gold`:void 0)},null,8,[`value`,`severity`,`class`]))}}),[[`__scopeId`,`data-v-75448977`]]);export{T as t};