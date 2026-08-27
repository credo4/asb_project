import{Gt as e,Kt as t,Pt as n,S as r,T as i,Ut as a,ln as o,rn as s,sn as c,un as l,xt as u,zt as d}from"./useApi-CROJJdhE-C1qgtaDP.js";var f=i.extend({name:`timeline`,style:`
    .p-timeline {
        display: flex;
        flex-grow: 1;
        flex-direction: column;
        direction: ltr;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .p-timeline-left .p-timeline-event-opposite {
        text-align: right;
    }

    .p-timeline-left .p-timeline-event-content {
        text-align: left;
    }

    .p-timeline-right .p-timeline-event {
        flex-direction: row-reverse;
    }

    .p-timeline-right .p-timeline-event-opposite {
        text-align: left;
    }

    .p-timeline-right .p-timeline-event-content {
        text-align: right;
    }

    .p-timeline-vertical.p-timeline-alternate .p-timeline-event:nth-child(even) {
        flex-direction: row-reverse;
    }

    .p-timeline-vertical.p-timeline-alternate .p-timeline-event:nth-child(odd) .p-timeline-event-opposite {
        text-align: right;
    }

    .p-timeline-vertical.p-timeline-alternate .p-timeline-event:nth-child(odd) .p-timeline-event-content {
        text-align: left;
    }

    .p-timeline-vertical.p-timeline-alternate .p-timeline-event:nth-child(even) .p-timeline-event-opposite {
        text-align: left;
    }

    .p-timeline-vertical.p-timeline-alternate .p-timeline-event:nth-child(even) .p-timeline-event-content {
        text-align: right;
    }

    .p-timeline-vertical .p-timeline-event-opposite,
    .p-timeline-vertical .p-timeline-event-content {
        padding: dt('timeline.vertical.event.content.padding');
    }

    .p-timeline-vertical .p-timeline-event-connector {
        width: dt('timeline.event.connector.size');
    }

    .p-timeline-event {
        display: flex;
        position: relative;
        min-height: dt('timeline.event.min.height');
    }

    .p-timeline-event:last-child {
        min-height: 0;
    }

    .p-timeline-event-opposite {
        flex: 1;
    }

    .p-timeline-event-content {
        flex: 1;
    }

    .p-timeline-event-separator {
        flex: 0;
        display: flex;
        align-items: center;
        flex-direction: column;
    }

    .p-timeline-event-marker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        align-self: baseline;
        border-width: dt('timeline.event.marker.border.width');
        border-style: solid;
        border-color: dt('timeline.event.marker.border.color');
        border-radius: dt('timeline.event.marker.border.radius');
        width: dt('timeline.event.marker.size');
        height: dt('timeline.event.marker.size');
        background: dt('timeline.event.marker.background');
    }

    .p-timeline-event-marker::before {
        content: ' ';
        border-radius: dt('timeline.event.marker.content.border.radius');
        width: dt('timeline.event.marker.content.size');
        height: dt('timeline.event.marker.content.size');
        background: dt('timeline.event.marker.content.background');
    }

    .p-timeline-event-marker::after {
        content: ' ';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: dt('timeline.event.marker.border.radius');
        box-shadow: dt('timeline.event.marker.content.inset.shadow');
    }

    .p-timeline-event-connector {
        flex-grow: 1;
        background: dt('timeline.event.connector.color');
    }

    .p-timeline-horizontal {
        flex-direction: row;
    }

    .p-timeline-horizontal .p-timeline-event {
        flex-direction: column;
        flex: 1;
    }

    .p-timeline-horizontal .p-timeline-event:last-child {
        flex: 0;
    }

    .p-timeline-horizontal .p-timeline-event-separator {
        flex-direction: row;
    }

    .p-timeline-horizontal .p-timeline-event-connector {
        width: 100%;
        height: dt('timeline.event.connector.size');
    }

    .p-timeline-horizontal .p-timeline-event-opposite,
    .p-timeline-horizontal .p-timeline-event-content {
        padding: dt('timeline.horizontal.event.content.padding');
    }

    .p-timeline-horizontal.p-timeline-alternate .p-timeline-event:nth-child(even) {
        flex-direction: column-reverse;
    }

    .p-timeline-bottom .p-timeline-event {
        flex-direction: column-reverse;
    }
`,classes:{root:function(e){var t=e.props;return[`p-timeline p-component`,`p-timeline-`+t.align,`p-timeline-`+t.layout]},event:`p-timeline-event`,eventOpposite:`p-timeline-event-opposite`,eventSeparator:`p-timeline-event-separator`,eventMarker:`p-timeline-event-marker`,eventConnector:`p-timeline-event-connector`,eventContent:`p-timeline-event-content`}}),p={name:`BaseTimeline`,extends:r,props:{value:null,align:{mode:String,default:`left`},layout:{mode:String,default:`vertical`},dataKey:null},style:f,provide:function(){return{$pcTimeline:this,$parentInstance:this}}};function m(e){"@babel/helpers - typeof";return m=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},m(e)}function h(e,t,n){return(t=g(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function g(e){var t=_(e,`string`);return m(t)==`symbol`?t:t+``}function _(e,t){if(m(e)!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t);if(m(r)!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}var v={name:`Timeline`,extends:p,inheritAttrs:!1,methods:{getKey:function(e,t){return this.dataKey?n(e,this.dataKey):t},getPTOptions:function(e,t){return this.ptm(e,{context:{index:t,count:this.value.length}})}},computed:{dataP:function(){return u(h(h({},this.layout,this.layout),this.align,this.align))}}},y=[`data-p`],b=[`data-p`],x=[`data-p`],S=[`data-p`],C=[`data-p`],w=[`data-p`],T=[`data-p`];function E(n,r,i,u,f,p){return c(),t(`ol`,s({class:n.cx(`root`)},n.ptmi(`root`),{"data-p":p.dataP}),[(c(!0),t(d,null,o(n.value,function(r,i){return c(),t(`li`,s({key:p.getKey(r,i),class:n.cx(`event`)},{ref_for:!0},p.getPTOptions(`event`,i),{"data-p":p.dataP}),[a(`div`,s({class:n.cx(`eventOpposite`,{index:i})},{ref_for:!0},p.getPTOptions(`eventOpposite`,i),{"data-p":p.dataP}),[l(n.$slots,`opposite`,{item:r,index:i})],16,x),a(`div`,s({class:n.cx(`eventSeparator`)},{ref_for:!0},p.getPTOptions(`eventSeparator`,i),{"data-p":p.dataP}),[l(n.$slots,`marker`,{item:r,index:i},function(){return[a(`div`,s({class:n.cx(`eventMarker`)},{ref_for:!0},p.getPTOptions(`eventMarker`,i),{"data-p":p.dataP}),null,16,C)]}),i===n.value.length-1?e(``,!0):l(n.$slots,`connector`,{key:0,item:r,index:i},function(){return[a(`div`,s({class:n.cx(`eventConnector`)},{ref_for:!0},p.getPTOptions(`eventConnector`,i),{"data-p":p.dataP}),null,16,w)]})],16,S),a(`div`,s({class:n.cx(`eventContent`)},{ref_for:!0},p.getPTOptions(`eventContent`,i),{"data-p":p.dataP}),[l(n.$slots,`content`,{item:r,index:i})],16,T)],16,b)}),128))],16,y)}v.render=E;export{v as t};