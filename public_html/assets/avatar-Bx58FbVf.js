import{Gt as e,Jn as t,Kt as n,S as r,T as i,Wt as a,Zn as o,pn as s,rn as c,sn as l,un as u,xt as d}from"./useApi-CROJJdhE-C1qgtaDP.js";var f=i.extend({name:`avatar`,style:`
    .p-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: dt('avatar.width');
        height: dt('avatar.height');
        font-size: dt('avatar.font.size');
        background: dt('avatar.background');
        color: dt('avatar.color');
        border-radius: dt('avatar.border.radius');
    }

    .p-avatar-image {
        background: transparent;
    }

    .p-avatar-circle {
        border-radius: 50%;
    }

    .p-avatar-circle img {
        border-radius: 50%;
    }

    .p-avatar-icon {
        font-size: dt('avatar.icon.size');
        width: dt('avatar.icon.size');
        height: dt('avatar.icon.size');
    }

    .p-avatar img {
        width: 100%;
        height: 100%;
    }

    .p-avatar-lg {
        width: dt('avatar.lg.width');
        height: dt('avatar.lg.width');
        font-size: dt('avatar.lg.font.size');
    }

    .p-avatar-lg .p-avatar-icon {
        font-size: dt('avatar.lg.icon.size');
        width: dt('avatar.lg.icon.size');
        height: dt('avatar.lg.icon.size');
    }

    .p-avatar-xl {
        width: dt('avatar.xl.width');
        height: dt('avatar.xl.width');
        font-size: dt('avatar.xl.font.size');
    }

    .p-avatar-xl .p-avatar-icon {
        font-size: dt('avatar.xl.icon.size');
        width: dt('avatar.xl.icon.size');
        height: dt('avatar.xl.icon.size');
    }

    .p-avatar-group {
        display: flex;
        align-items: center;
    }

    .p-avatar-group .p-avatar + .p-avatar {
        margin-inline-start: dt('avatar.group.offset');
    }

    .p-avatar-group .p-avatar {
        border: 2px solid dt('avatar.group.border.color');
    }

    .p-avatar-group .p-avatar-lg + .p-avatar-lg {
        margin-inline-start: dt('avatar.lg.group.offset');
    }

    .p-avatar-group .p-avatar-xl + .p-avatar-xl {
        margin-inline-start: dt('avatar.xl.group.offset');
    }
`,classes:{root:function(e){var t=e.props;return[`p-avatar p-component`,{"p-avatar-image":t.image!=null,"p-avatar-circle":t.shape===`circle`,"p-avatar-lg":t.size===`large`,"p-avatar-xl":t.size===`xlarge`}]},label:`p-avatar-label`,icon:`p-avatar-icon`}}),p={name:`BaseAvatar`,extends:r,props:{label:{type:String,default:null},icon:{type:String,default:null},image:{type:String,default:null},size:{type:String,default:`normal`},shape:{type:String,default:`square`},ariaLabelledby:{type:String,default:null},ariaLabel:{type:String,default:null}},style:f,provide:function(){return{$pcAvatar:this,$parentInstance:this}}};function m(e){"@babel/helpers - typeof";return m=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},m(e)}function h(e,t,n){return(t=g(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function g(e){var t=_(e,`string`);return m(t)==`symbol`?t:t+``}function _(e,t){if(m(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t);if(m(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}var v={name:`Avatar`,extends:p,inheritAttrs:!1,emits:[`error`],methods:{onError:function(e){this.$emit(`error`,e)}},computed:{dataP:function(){return d(h(h({},this.shape,this.shape),this.size,this.size))}}},y=[`aria-labelledby`,`aria-label`,`data-p`],b=[`data-p`],x=[`data-p`],S=[`src`,`alt`,`data-p`];function C(r,i,d,f,p,m){return l(),n(`div`,c({class:r.cx(`root`),"aria-labelledby":r.ariaLabelledby,"aria-label":r.ariaLabel},r.ptmi(`root`),{"data-p":m.dataP}),[u(r.$slots,`default`,{},function(){return[r.label?(l(),n(`span`,c({key:0,class:r.cx(`label`)},r.ptm(`label`),{"data-p":m.dataP}),o(r.label),17,b)):r.$slots.icon?(l(),a(s(r.$slots.icon),{key:1,class:t(r.cx(`icon`))},null,8,[`class`])):r.icon?(l(),n(`span`,c({key:2,class:[r.cx(`icon`),r.icon]},r.ptm(`icon`),{"data-p":m.dataP}),null,16,x)):r.image?(l(),n(`img`,c({key:3,src:r.image,alt:r.ariaLabel,onError:i[0]||=function(){return m.onError&&m.onError.apply(m,arguments)}},r.ptm(`image`),{"data-p":m.dataP}),null,16,S)):e(``,!0)]})],16,y)}v.render=C;export{v as t};